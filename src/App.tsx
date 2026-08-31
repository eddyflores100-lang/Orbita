import { useState } from "react";
import { ToastProvider } from "./components/Toast";
import ImportScreen from "./components/ImportScreen";
import Editor from "./components/Editor";
import { audio } from "./lib/audio";
import type { Project, Scene } from "./lib/data";

function Root() {
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);

  if (!project) {
    return (
      <ImportScreen
        onLoaded={(p, s) => {
          setProject(p);
          setScenes(s);
        }}
      />
    );
  }

  return (
    <Editor
      key={project.id}
      project={project}
      initialScenes={scenes}
      onExit={() => {
        audio.stopTrack();
        setProject(null);
        setScenes([]);
      }}
    />
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}
