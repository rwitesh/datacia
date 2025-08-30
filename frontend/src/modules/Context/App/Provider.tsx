import React, { useState, useEffect, useMemo } from "react";
import { AppContext, type Metadata } from "./Context";
import { Events } from "@wailsio/runtime"; 

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [metadata, setMetadata] = useState<Metadata | null>(null);

  useEffect(() => {
    const unsub = Events.On("clickhouse:connected", (ev) => {
      const meta = ev.data[0];
      setMetadata(meta);
    });

    return () => {
      unsub();
    };
  }, []);

  console.log("AppProvider metadata:", metadata);
  const value = useMemo(
    () => ({ metadata, setMetadata }),
    [metadata]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
