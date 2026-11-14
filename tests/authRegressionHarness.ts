import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as React from "react";

const require = createRequire(import.meta.url);

// Run the real modules, including JSX-in-.js, in Vitest's Node environment.
// Only imports at the boundary are replaced; no source rewriting/assertions.
export function loadAuthModule(url: URL, mocks: Record<string, unknown> = {}) {
  const source = readFileSync(url, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: "auth-module.tsx",
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const loadedModule = { exports: {} as any };
  new Function("require", "module", "exports", outputText)(
    (name: string) => name in mocks ? mocks[name] : require(name),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

const equalDeps = (a?: unknown[], b?: unknown[]) =>
  Boolean(a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i])));
let active: AuthHookHarness;

// A deliberately small hook runner: state, refs, memo dependencies and effect
// cleanup. This avoids installing a DOM or renderer dependency for auth races.
export class AuthHookHarness {
  slots: any[] = [];
  cursor = 0;
  effects: (() => void)[] = [];
  dirty = true;
  output: any;
  mounted = true;

  constructor(private component: (props: any) => any) {}

  render(props: any = {}) {
    this.cursor = 0;
    this.dirty = false;
    active = this;
    try {
      this.output = this.component(props);
    } finally {
      active = undefined;
    }
    const effects = this.effects.splice(0);
    effects.forEach((effect) => effect());
    return this.output;
  }

  async flush() {
    // Drain the finite fetch/json/cache promise chains; no timers or I/O.
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      if (this.dirty && this.mounted) this.render();
    }
  }

  unmount() {
    this.mounted = false;
    this.slots.forEach((slot) => slot?.cleanup?.());
  }
}

export const authReact = {
  ...React,
  useState(initial: any) {
    const frame = active;
    const i = frame.cursor++;
    if (!(i in frame.slots)) frame.slots[i] = { value: typeof initial === "function" ? initial() : initial };
    return [frame.slots[i].value, (next: any) => {
      if (!frame.mounted) return;
      const value = typeof next === "function" ? next(frame.slots[i].value) : next;
      if (!Object.is(value, frame.slots[i].value)) {
        frame.slots[i].value = value;
        frame.dirty = true;
      }
    }];
  },
  useRef(initial: any) {
    const frame = active;
    const i = frame.cursor++;
    return frame.slots[i] ??= { current: initial };
  },
  useCallback(callback: any, deps: any[]) {
    const frame = active;
    const i = frame.cursor++;
    if (!equalDeps(frame.slots[i]?.deps, deps)) frame.slots[i] = { value: callback, deps };
    return frame.slots[i].value;
  },
  useEffect(effect: () => any, deps: any[]) {
    const frame = active;
    const i = frame.cursor++;
    if (equalDeps(frame.slots[i]?.deps, deps)) return;
    frame.effects.push(() => {
      frame.slots[i]?.cleanup?.();
      frame.slots[i] = { deps, cleanup: effect() };
    });
  },
};

// Reconcile function components by type/key, leaving host elements intact for
// React DOM server rendering and behavioral input/button interaction tests.
export class AuthComponentTree {
  frames = new Map<string, { type: any; frame: AuthHookHarness }>();
  constructor(private component: any) {}

  render() {
    const visited = new Set<string>();
    const visit = (node: any, path: string): any => {
      if (Array.isArray(node)) return node.map((child, i) => visit(child, `${path}/${i}`));
      if (!React.isValidElement<any>(node)) return node;
      if (typeof node.type === "function") {
        path += `:${node.key ?? "default"}`;
        visited.add(path);
        let entry = this.frames.get(path);
        if (!entry || entry.type !== node.type) {
          entry?.frame.unmount();
          entry = { type: node.type, frame: new AuthHookHarness(node.type as any) };
          this.frames.set(path, entry);
        }
        return visit(entry.frame.render(node.props), `${path}/child`);
      }
      if (typeof node.type !== "string") return visit(node.props.children, `${path}/boundary`);
      return React.cloneElement(node, {}, visit(node.props.children, `${path}/children`));
    };
    const output = visit(React.createElement(this.component), "root");
    for (const [path, entry] of this.frames) {
      if (!visited.has(path)) {
        entry.frame.unmount();
        this.frames.delete(path);
      }
    }
    return output;
  }

  unmount() {
    this.frames.forEach(({ frame }) => frame.unmount());
  }
}

export function deferred<T = any>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
