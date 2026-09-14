import { useState, useRef } from "react";
import { Upload, X, CheckCircle } from "lucide-react";
import { useEscape, useScrollLock } from "@/lib/dialog";
import { isMidi, midiToMp3 } from "@/lib/midi-to-mp3";

/** Upload dialog plus a progress toast. MIDI is rendered to MP3 in the
    browser, then POSTed to /api/songs for metadata inference and storage. */
export function AddSong({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "converting" | "uploading" | "analyzing" | "success" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const busy = useRef(false);
  useEscape(onClose, { enabled: open });
  useScrollLock(open);
  // POSTs an MP3 file through the existing upload pipeline.
  const send = (toSend: File) => {
    setStatus("uploading");
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/songs");
    xhr.timeout = 125000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
        if (e.loaded === e.total) setStatus("analyzing");
      }
    };
    const fail = (message: string) => {
      busy.current = false;
      setStatus("error");
      setMessage(message);
    };
    xhr.onload = () => {
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        fail("Upload failed. Please retry.");
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        fail(result.error || "Upload failed.");
        return;
      }
      busy.current = false;
      setStatus("success");
      setProgress(100);
      setFile(null);
      onAdded(result.id); // opens the new song's detail
    };
    xhr.onerror = () => fail("Connection lost. Please retry.");
    xhr.ontimeout = () => fail("Upload timed out. Please retry.");
    const body = new FormData();
    body.append("file", toSend);
    xhr.send(body);
  };
  // MIDI files are synthesized to MP3 in the browser first, then uploaded.
  const upload = async () => {
    if (!file || busy.current) return;
    busy.current = true;
    setName(file.name);
    setProgress(0);
    setMessage("");
    onClose();
    if (isMidi(file)) {
      setStatus("converting");
      try {
        send(await midiToMp3(file));
      } catch (e) {
        busy.current = false;
        setStatus("error");
        setMessage(
          e instanceof Error ? e.message : "Could not convert this MIDI file.",
        );
      }
    } else {
      send(file);
    }
  };
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="upload-title" className="font-display text-2xl">
                Upload MIDI
              </h2>
              <button aria-label="Close upload" onClick={onClose}>
                <X />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Drop a MIDI file we’ll render to audio in your browser. We’ll read
              its duration and estimate its musical details.
            </p>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const dropped = e.dataTransfer.files[0];
                if (dropped && isMidi(dropped)) setFile(dropped);
              }}
              className={`my-6 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center ${drag ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <Upload className="h-9 w-9 text-primary" />
              <span className={file ? "font-medium text-foreground" : ""}>
                {file?.name || "Drag a MIDI file here, or click to browse"}
              </span>
              <span className="text-xs text-muted-foreground">
                MIDI · up to 30 MB
              </span>
              <input
                autoFocus
                aria-label="Choose a MIDI file"
                type="file"
                accept=".mid,.midi,audio/midi,audio/x-midi"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              disabled={!file || busy.current}
              onClick={upload}
              className="w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              Upload MIDI
            </button>
          </section>
        </div>
      )}
      {status !== "idle" && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[60] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-sm">
              {status === "success"
                ? "Upload complete"
                : status === "error"
                  ? "Upload failed"
                  : status === "converting"
                    ? "Converting MIDI…"
                    : status === "analyzing"
                      ? "Analyzing song…"
                      : "Uploading song…"}
            </strong>
            {!busy.current && (
              <button
                aria-label="Dismiss upload status"
                onClick={() => setStatus("idle")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{name}</p>
          {busy.current &&
            (status === "converting" ? (
              <p className="mt-3 text-xs">
                Rendering MIDI to audio in your browser… this can take a moment.
              </p>
            ) : (
              <>
                <progress
                  aria-label="Upload progress"
                  value={progress}
                  max={100}
                  className="mt-3 w-full accent-orange-800"
                />
                <p className="text-xs">
                  {progress}% uploaded
                  {status === "analyzing" ? " · Reading metadata" : ""}
                </p>
              </>
            ))}
          {status === "success" && (
            <CheckCircle className="mt-2 h-5 w-5 text-green-700" />
          )}
          {status === "error" && (
            <>
              <p className="mt-2 text-xs text-red-700">{message}</p>
              <button onClick={upload} className="mt-2 text-xs underline">
                Retry upload
              </button>
            </>
          )}
        </aside>
      )}
    </>
  );
}
