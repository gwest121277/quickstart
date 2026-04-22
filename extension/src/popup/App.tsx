import { useEffect, useRef, useState } from "react";

type Tab = {
  url: string;
  title: string;
  windowId: number;
  active: boolean;
};

type Capsule = {
  id?: string;
  project_id?: string;
  project_name?: string;
  ultimate_goal?: string;
  synthesis: string;
  next_move: string;
  key_noun: string;
  loose_threads: string[];
  tabs?: Tab[];
  created_at?: string;
  gap_type?: "short" | "overnight" | "long";
};

type Project = {
  id: string;
  name: string;
  ultimate_goal: string | null;
};

const API_BASE = "http://localhost:3001";
const MAX_SECONDS = 30;

async function grabTabs(): Promise<Tab[]> {
  const raw = await chrome.tabs.query({});
  return raw.map((t) => ({
    url: t.url ?? "",
    title: t.title ?? "",
    windowId: t.windowId,
    active: !!t.active,
  }));
}

type Status =
  | "idle"
  | "recording"
  | "uploading"
  | "synthesizing"
  | "saving"
  | "picking"
  | "done"
  | "error";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectsLoadError, setProjectsLoadError] = useState(false);
  const [hasAnyCapsules, setHasAnyCapsules] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [manageOpen, setManageOpen] = useState(false);
  const [seenResumeTip, setSeenResumeTip] = useState(true);
  const [showResumeTip, setShowResumeTip] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [transcript, setTranscript] = useState("");
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const tabsRef = useRef<Tab[]>([]);

  useEffect(() => {
    chrome.storage.local.get(
      ["lastProjectId", "seenResumeTip"],
      (r) => {
        if (r.lastProjectId) setProjectId(r.lastProjectId);
        setSeenResumeTip(!!r.seenResumeTip);
      }
    );

    loadProjects();
    return () => stopStream();
  }, []);

  async function loadProjects() {
    try {
      const r = await fetch(`${API_BASE}/api/projects`);
      if (!r.ok) throw new Error(`projects ${r.status}`);
      const j = await r.json();
      if (j.projects) setProjects(j.projects);
      if (typeof j.has_any_capsules === "boolean")
        setHasAnyCapsules(j.has_any_capsules);
      setProjectsLoadError(false);
    } catch {
      setProjectsLoadError(true);
    } finally {
      setProjectsLoaded(true);
    }
  }

  useEffect(() => {
    if (projectId) chrome.storage.local.set({ lastProjectId: projectId });
    setCapsule(null);
    setTranscript("");
    setTabs([]);
    tabsRef.current = [];
    setErrorMsg("");
  }, [projectId]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function reopenTabs(sourceTabs?: Tab[]) {
    const list = sourceTabs ?? tabsRef.current;
    const urls = list
      .map((t) => t.url)
      .filter((u) => u && /^https?:\/\//i.test(u));
    if (urls.length === 0) return;
    await chrome.windows.create({ url: urls, focused: true });
  }

  function openPermissionTab() {
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/permission/index.html"),
    });
  }

  async function startShutdown() {
    if (!projectId) {
      setErrorMsg("Pick a project first");
      setStatus("error");
      return;
    }
    setErrorMsg("");
    setTranscript("");
    setCapsule(null);

    try {
      const snapped = await grabTabs();
      setTabs(snapped);
      tabsRef.current = snapped;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = onStop;
      rec.start();

      setStatus("recording");
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) stopRecording();
          return next;
        });
      }, 1000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "mic failed");
    }
  }

  function stopRecording() {
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop();
    }
  }

  async function onStop() {
    stopStream();
    setStatus("uploading");

    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "shutdown.webm");
      const tRes = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        body: fd,
      });
      if (!tRes.ok) throw new Error(`transcribe ${tRes.status}`);
      const { transcript: t } = await tRes.json();
      setTranscript(t ?? "");

      setStatus("synthesizing");
      const cRes = await fetch(`${API_BASE}/api/capsule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: t,
          tabs: tabsRef.current,
          project_id: projectId,
        }),
      });
      if (!cRes.ok) {
        const detail = await cRes.text().catch(() => "");
        throw new Error(`capsule ${cRes.status}${detail ? ` ${detail.slice(0, 120)}` : ""}`);
      }
      const { capsule: cap } = await cRes.json();

      setStatus("saving");
      const sRes = await fetch(`${API_BASE}/api/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          tabs: tabsRef.current,
          raw_transcript: t,
          synthesis: cap.synthesis,
          next_move: cap.next_move,
          key_noun: cap.key_noun,
          loose_threads: cap.loose_threads,
        }),
      });
      if (!sRes.ok) {
        const detail = await sRes.text().catch(() => "");
        throw new Error(`save ${sRes.status}${detail ? ` ${detail.slice(0, 120)}` : ""}`);
      }

      setCapsule(cap);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "pipeline failed");
    }
  }

  async function pickup() {
    if (!projectId) {
      setErrorMsg("Pick a project first");
      setStatus("error");
      return;
    }
    setErrorMsg("");
    setStatus("picking");
    try {
      const res = await fetch(
        `${API_BASE}/api/pickup?project_id=${encodeURIComponent(projectId)}`
      );
      if (!res.ok) throw new Error(`pickup ${res.status}`);
      const { capsule: cap } = await res.json();
      if (!cap) {
        setStatus("error");
        setErrorMsg("No capsule saved for this project yet");
        return;
      }
      setCapsule(cap);
      const pickedTabs: Tab[] = cap.tabs ?? [];
      setTabs(pickedTabs);
      tabsRef.current = pickedTabs;
      if (!seenResumeTip) {
        setShowResumeTip(true);
      }
      setStatus("done");
      if (pickedTabs.length > 0) {
        reopenTabs(pickedTabs);
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "pickup failed");
    }
  }

  const recording = status === "recording";
  const working =
    status === "uploading" ||
    status === "synthesizing" ||
    status === "saving" ||
    status === "picking";
  const selectedProject = projects.find((p) => p.id === projectId);

  const zeroProjects =
    projectsLoaded && !projectsLoadError && projects.length === 0;
  const zeroCapsules =
    projectsLoaded && projects.length > 0 && !hasAnyCapsules && !capsule;

  function startOver() {
    setCapsule(null);
    setTranscript("");
    setErrorMsg("");
    setStatus("idle");
  }

  async function dismissResumeTip() {
    setShowResumeTip(false);
    setSeenResumeTip(true);
    await chrome.storage.local.set({ seenResumeTip: true });
  }

  if (projectsLoadError && !manageOpen) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="font-head text-3xl tracking-wide text-teal leading-none">
          QUICKSTART
        </h1>
        <div className="border border-red-400/40 rounded-lg p-4 space-y-3 bg-charcoal">
          <p className="text-sm leading-snug text-red-300">
            Backend unreachable.
          </p>
          <p className="text-xs text-soft/70 leading-snug">
            Start the dev server then retry:
            <br />
            <code className="text-teal">npm run dev</code> in{" "}
            <code className="text-teal">backend/</code>
          </p>
          <button
            onClick={loadProjects}
            className="w-full bg-teal text-charcoal font-semibold py-2 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (zeroProjects && !manageOpen) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="font-head text-3xl tracking-wide text-teal leading-none">
          QUICKSTART
        </h1>
        <div className="border border-teal/40 rounded-lg p-4 space-y-3 bg-charcoal">
          <p className="text-sm leading-snug">
            Projects are tasks you're working on.
          </p>
          <button
            onClick={() => setManageOpen(true)}
            className="w-full bg-teal text-charcoal font-semibold py-2 rounded text-sm"
          >
            New project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="font-head text-3xl tracking-wide text-teal leading-none">
          QUICKSTART
        </h1>
        {selectedProject?.ultimate_goal && (
          <p className="text-xs text-soft/70 italic leading-snug mt-1">
            {selectedProject.ultimate_goal}
          </p>
        )}
      </div>

      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        disabled={working || recording}
        className="w-full bg-charcoal border border-soft/30 text-soft rounded py-1.5 px-2 text-sm"
      >
        <option value="">Pick a project...</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="flex justify-end">
        <button
          onClick={() => setManageOpen((o) => !o)}
          className="text-[11px] text-soft/60 hover:text-teal"
        >
          {manageOpen ? "Close" : "Manage projects"}
        </button>
      </div>

      {manageOpen && (
        <ManagePanel
          projects={projects}
          onChanged={async () => {
            await loadProjects();
          }}
          onCreated={(newProject) => {
            setProjectId(newProject.id);
            setManageOpen(false);
          }}
          onDeleted={(deletedId) => {
            if (projectId === deletedId) setProjectId("");
          }}
        />
      )}

      {!manageOpen && (
      <>
      {zeroCapsules && (
        <div className="border border-teal/40 rounded-lg p-3 bg-charcoal">
          <p className="text-sm leading-snug">
            When you stop working, hit Shut Down and speak what you need to do
            next and what you won't forget to do when you come back, because you
            will forget. Upon return, pick your project and hit Resume.
          </p>
        </div>
      )}

      {!capsule && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {!recording && !working && (
              <>
                <button
                  onClick={pickup}
                  disabled={!projectId || zeroCapsules}
                  className="bg-charcoal border border-teal/60 text-teal font-semibold py-2 rounded text-sm disabled:opacity-40"
                  title={
                    zeroCapsules ? "Shut down first to create a capsule" : undefined
                  }
                >
                  Resume
                </button>
                <button
                  onClick={startShutdown}
                  disabled={!projectId}
                  className={
                    "bg-teal text-charcoal font-semibold py-2 rounded text-sm disabled:opacity-40 hover:brightness-110 " +
                    (zeroCapsules
                      ? "ring-2 ring-teal ring-offset-2 ring-offset-charcoal"
                      : "")
                  }
                >
                  Shut down
                </button>
              </>
            )}

            {recording && (
              <button
                onClick={stopRecording}
                className="col-span-2 bg-red-500 text-white font-semibold py-2 rounded text-sm"
              >
                Stop ({MAX_SECONDS - elapsed}s)
              </button>
            )}

            {working && (
              <div className="col-span-2 text-center text-xs text-soft/70 py-2 border border-soft/20 rounded">
                {status === "uploading" && "Transcribing..."}
                {status === "synthesizing" && "Synthesizing..."}
                {status === "saving" && "Saving..."}
                {status === "picking" && "Picking up..."}
              </div>
            )}
          </div>
          <p className="text-xs text-soft/60 text-center">{tabs.length} tabs</p>
        </>
      )}

      {errorMsg && (
        <div className="space-y-2">
          <p className="text-xs text-red-400">Error: {errorMsg}</p>
          {errorMsg.toLowerCase().includes("permission") && (
            <button
              onClick={openPermissionTab}
              className="w-full text-xs bg-soft/10 border border-soft/30 py-1.5 rounded hover:bg-soft/20"
            >
              Grant mic access in a tab
            </button>
          )}
        </div>
      )}

      {capsule && (
        <>
          <Card
            capsule={capsule}
            showTip={showResumeTip}
            onDismissTip={dismissResumeTip}
          />

          {transcript && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-soft/60 mb-1">
                Your note
              </p>
              <p className="text-xs text-soft/80 whitespace-pre-wrap leading-snug">
                {transcript}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={startOver}
              className="bg-charcoal border border-soft/30 text-soft font-semibold py-2 rounded text-sm hover:bg-soft/5"
            >
              Start over
            </button>
            <button
              onClick={() => window.close()}
              className="bg-teal text-charcoal font-semibold py-2 rounded text-sm hover:brightness-110"
            >
              Close
            </button>
          </div>
        </>
      )}

      {transcript && !capsule && (
        <div className="border-t border-soft/20 pt-3">
          <p className="text-xs text-soft/70 mb-1">Transcript</p>
          <p className="text-sm whitespace-pre-wrap">{transcript}</p>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function ManagePanel({
  projects,
  onChanged,
  onCreated,
  onDeleted,
}: {
  projects: Project[];
  onChanged: () => Promise<void>;
  onCreated: (project: Project) => void;
  onDeleted: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/project/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), ultimate_goal: newGoal.trim() }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "create failed");
      const { project } = await r.json();
      setNewName("");
      setNewGoal("");
      await onChanged();
      if (project) onCreated(project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-soft/20 pt-3">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-soft/60">
          New project
        </p>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="w-full bg-charcoal border border-soft/30 rounded px-2 py-1 text-sm"
        />
        <textarea
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          placeholder="Ultimate goal (optional)"
          rows={2}
          className="w-full bg-charcoal border border-soft/30 rounded px-2 py-1 text-xs resize-none"
        />
        <button
          onClick={create}
          disabled={busy || !newName.trim()}
          className="w-full bg-teal text-charcoal font-semibold py-1.5 rounded text-sm disabled:opacity-40"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>

      {err && <p className="text-xs text-red-400">Error: {err}</p>}

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-soft/60">
          Existing ({projects.length})
        </p>
        {projects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            canDelete={projects.length > 1}
            onChanged={onChanged}
            onDeleted={onDeleted}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  canDelete,
  onChanged,
  onDeleted,
}: {
  project: Project;
  canDelete: boolean;
  onChanged: () => Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [goal, setGoal] = useState(project.ultimate_goal ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const dirty =
    name !== project.name || goal !== (project.ultimate_goal ?? "");

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/project/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          name: name.trim(),
          ultimate_goal: goal.trim(),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "update failed");
      await onChanged();
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "update failed");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!canDelete) return;
    const yes = window.confirm(
      `Delete ${project.name} and all its capsules?`
    );
    if (!yes) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/project/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id }),
      });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error ?? "delete failed");
      }
      onDeleted(project.id);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="border border-soft/15 rounded p-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate">{project.name}</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] text-teal hover:underline"
            >
              Edit
            </button>
            <button
              onClick={del}
              disabled={!canDelete || busy}
              className="text-[11px] text-red-400 hover:underline disabled:opacity-30 disabled:no-underline"
              title={canDelete ? "Delete" : "Create another project first"}
            >
              Delete
            </button>
          </div>
        </div>
        {project.ultimate_goal && (
          <p className="text-[11px] text-soft/60 italic leading-snug">
            {project.ultimate_goal}
          </p>
        )}
        {err && <p className="text-[11px] text-red-400">{err}</p>}
      </div>
    );
  }

  return (
    <div className="border border-teal/40 rounded p-2 space-y-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-charcoal border border-soft/30 rounded px-2 py-1 text-sm"
      />
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={2}
        placeholder="Ultimate goal"
        className="w-full bg-charcoal border border-soft/30 rounded px-2 py-1 text-xs resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || !dirty || !name.trim()}
          className="flex-1 bg-teal text-charcoal font-semibold py-1 rounded text-xs disabled:opacity-40"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => {
            setName(project.name);
            setGoal(project.ultimate_goal ?? "");
            setEditing(false);
          }}
          disabled={busy}
          className="flex-1 border border-soft/30 py-1 rounded text-xs"
        >
          Cancel
        </button>
      </div>
      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </div>
  );
}

function Card({
  capsule,
  showTip,
  onDismissTip,
}: {
  capsule: Capsule;
  showTip?: boolean;
  onDismissTip?: () => void;
}) {
  const short = capsule.gap_type === "short";

  return (
    <div className="border border-teal/40 rounded-lg p-3 space-y-3 bg-charcoal">
      {showTip && (
        <div className="bg-teal/10 border border-teal/40 rounded p-2 flex items-start justify-between gap-2">
          <p className="text-xs leading-snug">
            This is your re-entry card. Read it, reopen your tabs, and go.
          </p>
          <button
            onClick={onDismissTip}
            className="text-xs text-teal shrink-0 hover:underline"
          >
            Got it
          </button>
        </div>
      )}
      {capsule.ultimate_goal && (
        <p className="text-[10px] uppercase tracking-wider text-soft/50">
          {capsule.ultimate_goal}
        </p>
      )}

      <div className="text-teal font-head text-2xl tracking-wide leading-none">
        {capsule.key_noun}
      </div>

      {!short && (
        <p className="text-sm leading-snug">{capsule.synthesis}</p>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-wider text-soft/60 mb-1">
          Next move
        </p>
        <p className="text-sm">{capsule.next_move}</p>
      </div>

      {!short && capsule.loose_threads.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-soft/60 mb-1">
            Loose threads
          </p>
          <ul className="text-xs space-y-1 list-disc list-inside text-soft/90">
            {capsule.loose_threads.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {capsule.gap_type && (
        <p className="text-[10px] uppercase tracking-wider text-soft/40">
          gap: {capsule.gap_type}
        </p>
      )}
    </div>
  );
}
