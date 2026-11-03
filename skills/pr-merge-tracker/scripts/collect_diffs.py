#!/usr/bin/env python3
"""Collect complete PR diffs for pr-merge-tracker reviews and compute honest review depth.

collect: fetch each PR's merge base and head into a blob-filtered bare cache, write the
         full net patch (no API file or size caps), a per-file inventory, and review chunks.
         With a prior reviewed head, the chunks hold only files whose net change moved.
depth:   given a manifest and the chunk ids a reviewer actually read, print reviewDepth.

Read-only against GitHub. Python 3.9 compatible.
"""
import argparse
import concurrent.futures
import json
import os
import pathlib
import re
import subprocess
import sys

GIT_AUTH = ["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential"]
ZERO = "0" * 40
GENERATED = re.compile(
    r"(^|/)(bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|go\.sum)$"
    r"|\.snap$|(^|/)__snapshots__/|(^|/)fixtures/|\.generated\.|(^|/)generated/|\.min\.(js|css)$|\.map$"
)
IMPORT_LINE = re.compile(
    r"""^\s*$|\bfrom\s+['"][^'"]+['"]\s*;?\s*$|^\s*import\s+['"][^'"]+['"]\s*;?\s*$"""
    r"""|\bimport\(\s*['"][^'"]+['"]\s*\)|\brequire\(\s*['"][^'"]+['"]\s*\)"""
)
EXPORT_LINE = re.compile(r"^\s*export\b")
CONFIG = re.compile(r"(^|/)(package\.json|tsconfig[^/]*\.json|[^/]*\.config\.[cm]?[jt]s|Dockerfile|wrangler\.[a-z]+)$|^\.github/")
TEST = re.compile(r"\.(test|spec)\.[cm]?[jt]sx?$|(^|/)tests?/")
REQUIRED = ("code", "config", "test", "doc")


# Lazy promisor fetches would pull full unshallow history one object at a time; every fetch here is explicit.
ENV = {**os.environ, "GIT_NO_LAZY_FETCH": "1", "GIT_TERMINAL_PROMPT": "0"}


def run(args, cwd=None, data=None, timeout=600):
    p = subprocess.run(args, cwd=cwd, input=data, capture_output=True, env=ENV, timeout=timeout)
    if p.returncode:
        raise RuntimeError(f"{' '.join(args[:6])}: {p.stderr.decode(errors='replace')[:400]}")
    return p.stdout


def gh_json(path):
    return json.loads(run(["gh", "api", path]))


def git(cache, *args, data=None):
    return run(["git", *GIT_AUTH, *args], cwd=str(cache), data=data)


def ensure_cache(cache, repo):
    if (cache / "HEAD").exists():
        return
    cache.mkdir(parents=True, exist_ok=True)
    run(["git", "init", "-q", "--bare", str(cache)])
    git(cache, "remote", "add", "origin", f"https://github.com/{repo}.git")
    git(cache, "config", "remote.origin.promisor", "true")
    git(cache, "config", "remote.origin.partialclonefilter", "blob:none")


def fetch_commits(cache, shas):
    missing = [s for s in sorted({s for s in shas if s}) if not has_object(cache, s)]
    if missing:
        git(cache, "fetch", "-q", "--no-tags", "--no-write-fetch-head", "--filter=blob:none", "--depth=1", "origin", *missing)


def has_object(cache, sha):
    p = subprocess.run(["git", "cat-file", "-e", sha], cwd=str(cache), capture_output=True, env=ENV)
    return p.returncode == 0


def prefetch_blobs(cache, blobs):
    wanted = "\n".join(b for b in sorted(set(blobs)) if b != ZERO) + "\n"
    out = run(["git", "cat-file", "--batch-check=%(objectname) %(objecttype)"], cwd=str(cache), data=wanted.encode())
    missing = [line.split()[0] for line in out.decode().splitlines() if line.endswith(" missing")]
    for i in range(0, len(missing), 5000):
        batch = ("\n".join(missing[i:i + 5000]) + "\n").encode()
        git(cache, "-c", "fetch.negotiationAlgorithm=noop", "fetch", "-q", "--no-tags", "--no-write-fetch-head",
            "--filter=blob:none", "--stdin", "origin", data=batch)


def tree_blobs(cache, a, b):
    """Blob ids on both sides of a tree-only diff; needs no blob content, so it is safe before prefetch."""
    out = git(cache, "diff", "--no-renames", "--raw", "--no-abbrev", a, b).decode(errors="surrogateescape")
    return [x for line in out.splitlines() if line.startswith(":") for x in line.split()[2:4]]


def raw_entries(cache, a, b):
    """Return [{status, similarity, old, new, path, oldPath}] in git diff order. Prefetch blobs first."""
    parts = git(cache, "diff", "-M", "--raw", "-z", "--no-abbrev", a, b).decode(errors="surrogateescape").split("\0")
    out, i = [], 0
    while i < len(parts) and parts[i]:
        meta = parts[i][1:].split()
        status = meta[4]
        if status[0] in "RC":
            out.append({"status": status[0], "similarity": int(status[1:] or 0), "old": meta[2], "new": meta[3],
                        "oldPath": parts[i + 1], "path": parts[i + 2]})
            i += 3
        else:
            out.append({"status": status[0], "similarity": None, "old": meta[2], "new": meta[3],
                        "oldPath": None, "path": parts[i + 1]})
            i += 2
    return out


def split_patch(text):
    files, cur = [], []
    for line in text.splitlines(keepends=True):
        if line.startswith("diff --git ") and cur:
            files.append("".join(cur))
            cur = []
        cur.append(line)
    if cur:
        files.append("".join(cur))
    return files


def classify(entry, patch):
    body = [l for l in patch.splitlines() if l[:1] in "+-" and not l.startswith(("+++", "---"))]
    if "\nBinary files " in patch or "\nGIT binary patch" in patch:
        return "binary", body
    if entry["status"] in "RC" and not body:
        return "rename-only", body
    if GENERATED.search(entry["path"]):
        return "generated", body
    # Re-exports change a module's public surface, so they never count as mechanical.
    if body and all(IMPORT_LINE.search(l[1:]) and not EXPORT_LINE.match(l[1:]) for l in body) \
            and any(l[1:].strip() for l in body):
        return "import-only", body
    if CONFIG.search(entry["path"]):
        return "config", body
    if TEST.search(entry["path"]):
        return "test", body
    if entry["path"].endswith((".md", ".mdx", ".txt")):
        return "doc", body
    return "code", body


def pieces(patch, limit):
    if len(patch) <= limit:
        return [patch]
    header, _, rest = patch.partition("\n@@")
    hunks = ["@@" + h for h in ("\n@@" + rest).split("\n@@")[1:]] if rest else []
    out, cur = [], header + "\n"
    for h in hunks:
        h = h if h.endswith("\n") else h + "\n"
        while len(h) > limit:
            cut = h.rfind("\n", 0, limit) + 1 or limit
            out.append(cur + h[:cut])
            cur, h = header + "\n[continued hunk]\n", h[cut:]
        if len(cur) + len(h) > limit and cur.strip() != header.strip():
            out.append(cur)
            cur = header + "\n"
        cur += h
    out.append(cur)
    return out


def build_chunks(files, limit, outdir):
    order = {"code": 0, "config": 1, "test": 2, "doc": 3, "import-only": 4, "generated": 5, "binary": 6}
    chunks, cur, kind = [], [], None

    def flush():
        if cur:
            cid = f"{len(chunks) + 1:03d}"
            (outdir / f"{cid}.patch").write_text("".join(p for _, p in cur), errors="surrogateescape")
            chunks.append({"id": cid, "kind": kind, "chars": sum(len(p) for _, p in cur),
                           "files": sorted({f["path"] for f, _ in cur})})
            for f, _ in cur:
                f.setdefault("chunks", []).append(cid)
        cur.clear()

    for f in sorted((f for f in files if f["class"] != "rename-only"), key=lambda f: (order[f["class"]], f["path"])):
        k = "required" if f["class"] in REQUIRED else "mechanical" if f["class"] == "import-only" else "generated"
        for piece in pieces(f.pop("_patch"), limit):
            if kind != k or (cur and sum(len(p) for _, p in cur) + len(piece) > limit):
                flush()
                kind = k
            cur.append((f, piece))
    flush()
    for f in files:
        f.pop("_patch", None)
    return chunks


def change_key(f):
    body = [l for l in f["_patch"].splitlines() if l[:1] in "+-" and not l.startswith(("+++", "---"))]
    return f["status"], f["oldPath"], tuple(body)


def net_files(cache, base, head):
    entries = raw_entries(cache, base, head)
    patches = split_patch(git(cache, "diff", "-M", "--no-color", "--no-ext-diff", base, head).decode(errors="surrogateescape"))
    if len(patches) != len(entries):
        raise RuntimeError(f"patch/raw mismatch {len(patches)} != {len(entries)}")
    files = []
    for e, p in zip(entries, patches):
        cls, body = classify(e, p)
        files.append({**e, "class": cls, "added": sum(l[0] == "+" for l in body),
                      "deleted": sum(l[0] == "-" for l in body), "_patch": p})
    return files


def resolve(n, args, prior_heads):
    """GitHub API reads only: refs and merge bases for the current and prior reviewed heads."""
    pr = gh_json(f"repos/{args.repo}/pulls/{n}")
    base, head = pr["base"]["sha"], pr["head"]["sha"]
    mb = gh_json(f"repos/{args.repo}/compare/{base}...{head}?per_page=1")["merge_base_commit"]["sha"]
    prior = None if args.full else prior_heads.get(str(n))
    prior_mb, note = None, None
    if prior and prior != head:
        try:
            prior_mb = gh_json(f"repos/{args.repo}/compare/{base}...{prior}?per_page=1")["merge_base_commit"]["sha"]
        except RuntimeError as e:  # prior head garbage-collected after a force-push
            prior, note = None, {"deltaFallback": str(e)[:300]}
    return {"n": n, "pr": pr, "base": base, "head": head, "mb": mb, "prior": prior, "priorMb": prior_mb, "note": note}


def write_one(r, args, cache):
    n, files = r["n"], r["files"]
    mode, note = "net", r["note"]
    if r["prior"] == r["head"]:
        mode = "unchanged"
    elif r["prior"]:
        # A file is in the delta when its own +/- lines or rename source changed; main-only churn is not.
        before = {f["path"]: change_key(f) for f in net_files(cache, r["priorMb"], r["prior"])}
        for f in files:
            f["deltaChanged"] = before.get(f["path"]) != change_key(f)
        mode = "delta"
        note = {"priorHead": r["prior"], "priorMergeBase": r["priorMb"],
                "droppedFromNet": sorted(set(before) - {f["path"] for f in files})}
    outdir = pathlib.Path(args.out) / str(n)
    (outdir / "chunks").mkdir(parents=True, exist_ok=True)
    for old in (outdir / "chunks").glob("*.patch"):
        old.unlink()
    (outdir / "net.patch").write_text("".join(f["_patch"] for f in files), errors="surrogateescape")
    review = [f for f in files if mode == "net" or f.get("deltaChanged")]
    for f in files:
        if f not in review:
            f.pop("_patch")
    chunks = [] if mode == "unchanged" else build_chunks(review, args.chunk_chars, outdir / "chunks")
    pr = r["pr"]
    manifest = {
        "number": n, "title": pr["title"], "baseRef": pr["base"]["ref"], "base": r["base"], "mergeBase": r["mb"],
        "head": r["head"], "mode": mode, "delta": note, "githubChangedFiles": pr["changed_files"],
        "gitFiles": len(files), "gitFilesNoRenames": r["noRenameFiles"],
        # Rename pairing differs between git and GitHub; any count between paired and unpaired is complete.
        "inventoryComplete": len(files) <= pr["changed_files"] <= r["noRenameFiles"],
        "classes": {c: sum(f["class"] == c for f in files) for c in sorted({f["class"] for f in files})},
        "reviewFiles": len(review), "chunks": chunks, "files": files,
    }
    (outdir / "manifest.json").write_text(json.dumps(manifest, indent=1))
    (outdir / "inventory.txt").write_text("".join(
        f"{f['status']}{f['similarity'] or ''}\t{f['class']}\t+{f['added']}/-{f['deleted']}\t"
        f"{(f['oldPath'] + ' -> ') if f['oldPath'] else ''}{f['path']}\t{','.join(f.get('chunks', []))}\n" for f in files))
    return {"number": n, "mode": mode, "files": len(files), "inventoryComplete": manifest["inventoryComplete"],
            "requiredChunks": sum(c["kind"] == "required" for c in chunks), "chunks": len(chunks),
            "requiredChars": sum(c["chars"] for c in chunks if c["kind"] == "required")}


def phase(fn, items, workers, errors):
    """Run fn over items; failures are recorded per PR, never dropped silently."""
    out = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(fn, it): it for it in items}
        for fut in concurrent.futures.as_completed(futures):
            it = futures[fut]
            try:
                out.append(fut.result())
            except Exception as e:
                errors.append({"number": it if isinstance(it, int) else it["n"], "error": str(e)[:400]})
    return out


def collect(args):
    if not args.repo:
        args.repo = run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).decode().strip()
    cache = pathlib.Path(args.cache or f"~/.agents/state/pr-merge-tracker/git/{args.repo.replace('/', '--')}.git").expanduser()
    ensure_cache(cache, args.repo)
    prior = {}
    if args.state and not args.full:
        prs = json.load(open(pathlib.Path(args.state).expanduser())).get("prs", {})
        prior = {k: v.get("reviewedHeadSha") for k, v in prs.items() if v.get("reviewedHeadSha")}
    numbers = [int(x) for x in args.numbers] if args.numbers else json.load(open(args.input))
    errors = []
    refs = phase(lambda n: resolve(n, args, prior), numbers, args.workers, errors)
    # One shallow fetch for every commit: concurrent shallow fetches contend on shallow.lock.
    fetch_commits(cache, [s for r in refs for s in (r["mb"], r["head"])])
    try:
        fetch_commits(cache, [s for r in refs if r["priorMb"] for s in (r["priorMb"], r["prior"])])
    except RuntimeError:
        for r in (r for r in refs if r["priorMb"]):
            try:
                fetch_commits(cache, [r["priorMb"], r["prior"]])
            except RuntimeError as e:  # unreachable prior head: fall back to a full net review
                r["prior"], r["note"] = None, {"deltaFallback": str(e)[:300]}
    pairs = [(r["mb"], r["head"]) for r in refs] + [(r["priorMb"], r["prior"]) for r in refs if r["priorMb"]]
    prefetch_blobs(cache, [b for a, h in pairs for b in tree_blobs(cache, a, h)])

    def build(r):
        r["files"] = net_files(cache, r["mb"], r["head"])
        r["noRenameFiles"] = len(tree_blobs(cache, r["mb"], r["head"])) // 2
        return write_one(r, args, cache)

    results = phase(build, refs, args.workers, errors)
    index = {"results": sorted(results, key=lambda r: r["number"]), "errors": errors}
    pathlib.Path(args.out).mkdir(parents=True, exist_ok=True)
    (pathlib.Path(args.out) / "index.json").write_text(json.dumps(index, indent=1))
    print(json.dumps({"collected": len(results), "errors": errors,
                      "inventoryMismatch": [r["number"] for r in results if not r["inventoryComplete"]],
                      "modes": {m: sum(r["mode"] == m for r in results) for m in ("net", "delta", "unchanged")}}, indent=1))
    return 1 if errors else 0


def depth(args):
    m = json.load(open(args.manifest))
    read = set(args.read or [])
    if args.read_file:
        read |= set(json.load(open(args.read_file)))
    if m["mode"] == "unchanged":
        print(json.dumps({"reviewDepth": "prior (head unchanged)", "sampled": False, "coverage": 1.0}))
        return 0
    req = [c for c in m["chunks"] if c["kind"] == "required"]
    got = [c for c in req if c["id"] in read]
    chars = sum(c["chars"] for c in req) or 1
    cov = sum(c["chars"] for c in got) / chars
    cls = m["classes"]
    machine = ", ".join(f"{cls[c]} {c}" for c in ("import-only", "rename-only", "generated", "binary") if cls.get(c))
    scope = f"delta {m['reviewFiles']}/{m['gitFiles']} files" if m["mode"] == "delta" else f"net {m['gitFiles']} files"
    complete = len(got) == len(req) and m["inventoryComplete"]
    label = ("full" if complete else f"sampled {round(cov * 100)}%") + f" ({scope}"
    label += f"; machine-classified: {machine})" if machine else ")"
    if not m["inventoryComplete"]:
        label += f" [inventory mismatch: git {m['gitFiles']}-{m['gitFilesNoRenames']}, GitHub {m['githubChangedFiles']}]"
    print(json.dumps({"reviewDepth": label, "sampled": not complete, "coverage": round(cov, 3),
                      "unreadRequiredChunks": [c["id"] for c in req if c["id"] not in read]}))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("collect")
    c.add_argument("-R", "--repo", help="owner/repo; defaults to the current checkout's GitHub repository")
    c.add_argument("--out", required=True)
    c.add_argument("--input", help="JSON list of PR numbers")
    c.add_argument("--state", help="tracker state JSON; enables delta mode from reviewedHeadSha")
    c.add_argument("--full", action="store_true", help="ignore prior heads; review the whole net diff")
    c.add_argument("--cache", help="bare git cache; default ~/.agents/state/pr-merge-tracker/git/<owner>--<repo>.git")
    c.add_argument("--chunk-chars", type=int, default=80_000)
    c.add_argument("--workers", type=int, default=6)
    c.add_argument("numbers", nargs="*")
    d = sub.add_parser("depth")
    d.add_argument("manifest")
    d.add_argument("--read", nargs="*", help="chunk ids the reviewer read")
    d.add_argument("--read-file", help="JSON list of chunk ids the reviewer read")
    args = ap.parse_args()
    if args.cmd == "collect" and not (args.numbers or args.input):
        ap.error("collect needs PR numbers or --input")
    sys.exit(collect(args) if args.cmd == "collect" else depth(args))


if __name__ == "__main__":
    main()
