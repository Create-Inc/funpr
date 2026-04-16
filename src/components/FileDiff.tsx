import { MessageSquarePlus } from "lucide-react";
import type { PRFile } from "../lib/github";

interface FileDiffProps {
  file: PRFile;
  onComment: (line: number) => void;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  lineNumber: number | null;
}

function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];
  const lines = patch.split("\n");
  const result: DiffLine[] = [];
  let lineNum = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      lineNum = match ? parseInt(match[1], 10) - 1 : lineNum;
      result.push({ type: "header", content: line, lineNumber: null });
    } else if (line.startsWith("+")) {
      lineNum++;
      result.push({ type: "add", content: line.slice(1), lineNumber: lineNum });
    } else if (line.startsWith("-")) {
      result.push({ type: "remove", content: line.slice(1), lineNumber: null });
    } else {
      lineNum++;
      result.push({ type: "context", content: line.slice(1), lineNumber: lineNum });
    }
  }
  return result;
}

export function FileDiff({ file, onComment }: FileDiffProps) {
  if (!file.patch) {
    return <div className="p-3 text-sm text-gray-500">Binary file or too large to display</div>;
  }

  const lines = parsePatch(file.patch);

  return (
    <div className="overflow-x-auto text-xs">
      <table className="w-full">
        <tbody>
          {lines.map((line, i) => {
            const bgColor =
              line.type === "add"
                ? "bg-green-950/40"
                : line.type === "remove"
                  ? "bg-red-950/40"
                  : line.type === "header"
                    ? "bg-blue-950/30"
                    : "";
            const textColor =
              line.type === "add"
                ? "text-green-300"
                : line.type === "remove"
                  ? "text-red-300"
                  : line.type === "header"
                    ? "text-blue-300"
                    : "text-gray-400";

            return (
              <tr key={i} className={`${bgColor} group`}>
                <td className="w-8 select-none px-2 text-right text-gray-600">
                  {line.lineNumber ?? ""}
                </td>
                <td className="w-6 select-none">
                  {line.lineNumber && (
                    <button
                      onClick={() => onComment(line.lineNumber!)}
                      className="hidden rounded p-0.5 text-gray-600 hover:bg-gray-700 hover:text-blue-400 group-hover:block"
                      title="Add comment"
                    >
                      <MessageSquarePlus className="h-3 w-3" />
                    </button>
                  )}
                </td>
                <td className={`whitespace-pre px-2 font-mono ${textColor}`}>
                  {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                  {line.content}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
