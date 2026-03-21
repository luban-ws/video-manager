import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

interface FolderSelectDialogProps {
  onSelect: (path: string) => void;
}

export default function FolderSelectDialog({ onSelect }: FolderSelectDialogProps) {
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);

  const handleSelectExisting = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择工作目录",
      });

      if (selected && typeof selected === "string") {
        // 检查目录是否为空
        const isEmpty = await invoke<boolean>("is_directory_empty", {
          dirPath: selected,
        });

        if (!isEmpty) {
          const confirm = window.confirm(
            "所选目录不为空。是否仍要使用此目录？\n\n注意：应用会扫描此目录中的所有 Markdown 文件。"
          );
          if (!confirm) {
            return;
          }
        }

        onSelect(selected);
      }
    } catch (error) {
      console.error("选择目录失败:", error);
      alert("选择目录失败: " + error);
    }
  };

  const handleSelectParent = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择父目录（新文件夹将在此创建）",
      });

      if (selected && typeof selected === "string") {
        setParentPath(selected);
      }
    } catch (error) {
      console.error("选择父目录失败:", error);
      alert("选择父目录失败: " + error);
    }
  };

  const handleCreateNew = async () => {
    if (!newFolderName.trim()) {
      alert("请输入文件夹名称");
      return;
    }

    if (!parentPath) {
      alert("请先选择父目录");
      return;
    }

    setCreating(true);
    try {
      const newPath = await invoke<string>("create_directory", {
        parentPath,
        folderName: newFolderName.trim(),
      });

      onSelect(newPath);
    } catch (error: unknown) {
      console.error("创建目录失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert("创建目录失败: " + errorMessage);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">设置工作目录</h2>
        <p className="text-gray-600 mb-6">
          请选择一个空文件夹或创建新文件夹作为工作目录。所有视频文档将存储在此目录中。
        </p>

        <div className="space-y-4">
          {/* 选择现有文件夹 */}
          <div>
            <button
              onClick={handleSelectExisting}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              选择现有文件夹
            </button>
          </div>

          {/* 创建新文件夹 */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">或创建新文件夹</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  父目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={parentPath || ""}
                    placeholder="未选择"
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                  <button
                    onClick={handleSelectParent}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                  >
                    选择
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文件夹名称
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="例如: video-manager"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!parentPath || creating}
                />
              </div>

              <button
                onClick={handleCreateNew}
                disabled={!parentPath || !newFolderName.trim() || creating}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "创建中..." : "创建新文件夹"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
