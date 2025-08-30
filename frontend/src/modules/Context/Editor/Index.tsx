import { useContext } from "react";
import { EditorContext } from "./Context";

export const useEditorContext = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return ctx;
};
