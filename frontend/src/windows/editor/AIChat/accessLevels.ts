import { Database, EyeOff, TableProperties, type LucideIcon } from "lucide-react";
import { Access } from "@/services/ai";

/** What each access level lets the AI see, as the chat describes it. */
export const accessLevels: { access: Access; label: string; description: string; summary: string; icon: LucideIcon }[] = [
  {
    access: Access.AccessNone,
    label: "No access",
    description: "Answers questions and helps write SQL without seeing your database.",
    summary: "It answers questions and helps write SQL, but can't see your database.",
    icon: EyeOff,
  },
  {
    access: Access.AccessSchema,
    label: "Schema only",
    description: "Sees table names and columns, never the rows in them.",
    summary: "It looks through your tables and columns to help write SQL, but can't see the rows in them.",
    icon: TableProperties,
  },
  {
    access: Access.AccessData,
    label: "Schema and data",
    description: "Also runs read-only queries and reads the rows they return.",
    summary: "It looks through your tables, runs read-only queries and explains what it finds.",
    icon: Database,
  },
];

export function accessLevel(access: Access) {
  return accessLevels.find((l) => l.access === access) ?? accessLevels[1];
}
