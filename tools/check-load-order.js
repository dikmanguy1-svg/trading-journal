/*
 * check-load-order.js — checks the js/ files before an upload.
 *
 * Run from the repo folder:   node tools/check-load-order.js
 *
 * The site loads js/*.js as plain scripts, one after the other, in the order index.html
 * lists them. They share one global scope. A function is usable by an earlier file only
 * after its own file has loaded. This tool finds code that RUNS WHILE LOADING (not inside
 * a click handler or a function) and uses something from a file that loads later.
 * It also checks that every file parses. Exit code 1 = a problem was found.
 *
 * Needs the "acorn" and "acorn-walk" packages (npm i -g acorn acorn-walk, or set NODE_PATH).
 */
const fs = require("fs");
const path = require("path");
let acorn;
try {
  acorn = require("acorn");
} catch (e) {
  acorn = require("/opt/npm-tools/node_modules/acorn");
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const files = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
if (!files.length) throw new Error("no js/ scripts found in index.html");

let problems = 0;
const decl = new Map(); // name -> { file index, function node or null }
const bodies = [];
files.forEach((f, fi) => {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  let ast;
  try {
    ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script" });
  } catch (e) {
    console.log(`PARSE ERROR in ${f}: ${e.message}`);
    problems++;
    return;
  }
  bodies.push([fi, ast]);
  for (const n of ast.body) {
    if (n.type === "FunctionDeclaration") decl.set(n.id.name, { fi, fn: n.body });
    if (n.type === "VariableDeclaration")
      for (const d of n.declarations)
        if (d.id.type === "Identifier")
          decl.set(d.id.name, { fi, fn: d.init && /Function/.test(d.init.type) ? d.init.body : null });
  }
});

// Identifiers used by a node. When "now" is true, functions that only run later
// (event handlers, timers, functions stored in variables or objects) are skipped.
function used(node, now) {
  const out = new Set();
  const calls = new Set();
  (function visit(n, parent, key) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "Identifier") {
      const isProp = parent && ((parent.type === "MemberExpression" && key === "property" && !parent.computed) || (parent.type === "Property" && key === "key" && !parent.computed));
      const isDecl = parent && parent.type === "VariableDeclarator" && key === "id";
      if (!isProp && !isDecl) out.add(n.name);
      if (parent && parent.type === "CallExpression" && key === "callee") calls.add(n.name);
    }
    if (now && /Function/.test(n.type) && parent) {
      const later =
        n.type === "FunctionDeclaration" ||
        parent.type === "VariableDeclarator" ||
        parent.type === "Property" ||
        parent.type === "AssignmentExpression" ||
        parent.type === "ReturnStatement" ||
        parent.type === "NewExpression" ||
        (parent.type === "CallExpression" && key === "arguments" && /addEventListener|setTimeout|setInterval|requestAnimationFrame|then|catch|finally/.test(parent.callee.property ? parent.callee.property.name : parent.callee.name || ""));
      if (later) return;
    }
    for (const k of Object.keys(n)) {
      if (k === "type" || k === "start" || k === "end") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(x => visit(x, n, k));
      else if (v && typeof v.type === "string") visit(v, n, k);
    }
  })(node, null, null);
  return { refs: out, calls };
}

const fnUses = new Map();
for (const [name, d] of decl) if (d.fn) fnUses.set(name, used(d.fn, false));

for (const [fi, ast] of bodies)
  for (const n of ast.body) {
    if (n.type === "FunctionDeclaration") continue;
    // names used right now; names of functions called right now (their bodies run now too)
    const first = used(n, true);
    const seen = new Set();
    const todo = [...first.refs].map(x => [x, first.calls.has(x)]);
    while (todo.length) {
      const [name, called] = todo.pop();
      const d = decl.get(name);
      if (!d) continue;
      if (d.fi > fi && !seen.has(name)) {
        console.log(`LOAD ORDER: ${files[fi]} runs code at load time that uses "${name}" from ${files[d.fi]}, which loads later.`);
        problems++;
      }
      if (called && !seen.has("call:" + name) && fnUses.has(name)) {
        seen.add("call:" + name);
        const u = fnUses.get(name);
        for (const r of u.refs) todo.push([r, u.calls.has(r)]);
      }
      seen.add(name);
    }
  }

console.log(problems ? `${problems} problem(s) found.` : `OK: ${files.length} files, load order is safe.`);
process.exit(problems ? 1 : 0);
