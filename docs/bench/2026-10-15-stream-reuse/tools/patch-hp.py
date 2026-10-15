p = "/tmp/bc-ss/paseo/packages/app/src/debug/host-perf.ts"
s = open(p).read()
old = '      if (command.cmd === "open" && command.url) void Linking.openURL(command.url);'
new = '''      if (command.cmd === "open" && command.url) {
        // A fresh install never loaded the workspace directory (the sidebar
        // does that), so the workspace route would wait on it forever.
        const url = command.url;
        const serverId = /\\/h\\/([^/]+)\\//.exec(url)?.[1];
        const store = (globalThis as { __paseoHostRuntimeStore?: { refreshWorkspaceDirectory?: (input: { serverId: string; subscribe?: boolean }) => Promise<void> } }).__paseoHostRuntimeStore;
        const refreshed = serverId && store?.refreshWorkspaceDirectory ? store.refreshWorkspaceDirectory({ serverId, subscribe: true }) : Promise.resolve();
        void refreshed.catch(() => {}).then(() => Linking.openURL(url));
      }'''
assert old in s
s = s.replace(old, new, 1)
open(p, "w").write(s)
