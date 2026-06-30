/**
 * 手機記事本 App — 主程式
 * 功能：localStorage 自動存檔、檔案管理、富文字編輯、尋找取代
 */

(function () {
  "use strict";

  // localStorage 儲存鍵名
  const STORAGE_KEY = "mobile-notepad-draft";

  // ===== DOM 元素參考 =====
  const editor = document.getElementById("editor");
  const docTitle = document.getElementById("doc-title");
  const fileInput = document.getElementById("file-input");
  const toast = document.getElementById("toast");

  const fileSheet = document.getElementById("file-sheet");
  const editSheet = document.getElementById("edit-sheet");
  const findModal = document.getElementById("find-modal");
  const replaceModal = document.getElementById("replace-modal");
  const saveasModal = document.getElementById("saveas-modal");

  // ===== 應用程式狀態 =====
  const state = {
    fileName: "未命名文件",
    fileExt: ".txt",
    isDirty: false,
    fontSize: 16,
    findIndex: 0,
    findMatches: [],
  };

  let autoSaveTimer = null;
  let isRestoring = false; // 載入 localStorage 時避免觸發自動存檔

  // ===== 工具函式 =====

  /** 顯示短暫提示訊息 */
  let toastTimer = null;
  function showToast(message, duration = 2200) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, duration);
  }

  /** 取得編輯區純文字內容 */
  function getPlainText() {
    return editor.innerText || "";
  }

  /** 設定編輯區純文字內容 */
  function setPlainText(text) {
    editor.textContent = text;
    markDirtyAndAutoSave();
  }

  /** 更新標題列虛擬檔名顯示 */
  function updateTitle() {
    const dirtyMark = state.isDirty ? " •" : "";
    docTitle.textContent = state.fileName + dirtyMark;
  }

  /** 開啟底部選單 */
  function openSheet(sheet) {
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
  }

  /** 關閉所有底部選單 */
  function closeAllSheets() {
    fileSheet.hidden = true;
    editSheet.hidden = true;
    document.body.style.overflow = "";
  }

  /** 開啟對話框 */
  function openModal(modal) {
    modal.hidden = false;
    setTimeout(() => {
      const input = modal.querySelector("input");
      if (input) input.focus();
    }, 100);
  }

  /** 關閉對話框 */
  function closeModal(modal) {
    modal.hidden = true;
  }

  /** 確保編輯區取得焦點（格式化指令需要） */
  function focusEditor() {
    editor.focus();
  }

  // ===== localStorage 自動存檔 =====

  /** 將目前狀態序列化並寫入 localStorage */
  function saveToLocalStorage(silent = false) {
    try {
      const data = {
        html: editor.innerHTML,
        fileName: state.fileName,
        fileExt: state.fileExt,
        fontSize: state.fontSize,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      state.isDirty = false;
      updateTitle();
      if (!silent) {
        showToast("已儲存至瀏覽器");
      }
    } catch (err) {
      if (!silent) {
        showToast("儲存失敗，瀏覽器空間可能已滿");
      }
    }
  }

  /** 從 localStorage 還原上次編輯內容 */
  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      isRestoring = true;

      if (data.html) {
        editor.innerHTML = data.html;
      }
      if (data.fileName) {
        state.fileName = data.fileName;
      }
      if (data.fileExt) {
        state.fileExt = data.fileExt;
      }
      if (data.fontSize) {
        state.fontSize = data.fontSize;
        editor.style.fontSize = state.fontSize + "px";
      }

      state.isDirty = false;
      updateTitle();
      isRestoring = false;
      return true;
    } catch {
      isRestoring = false;
      return false;
    }
  }

  /** 清除 localStorage 中的草稿 */
  function clearLocalStorage() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /** 標記為已變更並排程背景自動存檔 */
  function markDirtyAndAutoSave() {
    if (isRestoring) return;

    state.isDirty = true;
    updateTitle();

    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveToLocalStorage(true);
    }, 400);
  }

  // ===== 檔案功能 =====

  /** 新建檔案 */
  function newFile() {
    if (getPlainText().trim()) {
      const ok = confirm("確定要新建檔案嗎？目前內容將被清除。");
      if (!ok) return;
    }

    editor.innerHTML = "";
    state.fileName = "未命名文件";
    state.fileExt = ".txt";
    state.fontSize = 16;
    editor.style.fontSize = "16px";
    clearLocalStorage();
    saveToLocalStorage(true);
    showToast("已新建檔案");
    focusEditor();
  }

  /** 觸發開啟檔案對話框 */
  function openFile() {
    fileInput.click();
  }

  /** 處理使用者選擇的檔案 */
  function handleFileOpen(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target.result;
      isRestoring = true;

      if (file.name.match(/\.html?$/i)) {
        editor.innerHTML = content;
      } else {
        editor.textContent = content;
      }

      const dotIndex = file.name.lastIndexOf(".");
      if (dotIndex > 0) {
        state.fileName = file.name.slice(0, dotIndex);
        state.fileExt = file.name.slice(dotIndex);
      } else {
        state.fileName = file.name;
        state.fileExt = ".txt";
      }

      isRestoring = false;
      saveToLocalStorage(true);
      showToast("已開啟：" + file.name);
      focusEditor();
    };
    reader.readAsText(file, "UTF-8");
    event.target.value = "";
  }

  /**
   * 將內容儲存為檔案並觸發瀏覽器下載（僅用於「另存新檔」）
   */
  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  /** 依副檔名決定 MIME 類型 */
  function getMimeType(ext) {
    const map = {
      ".txt": "text/plain",
      ".py": "text/x-python",
      ".html": "text/html",
      ".htm": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".md": "text/markdown",
      ".xml": "text/xml",
    };
    return map[ext] || "text/plain";
  }

  /** 取得要下載的內容（HTML 格式保留標記，其餘存純文字） */
  function getSaveContent(ext) {
    if (ext === ".html" || ext === ".htm") {
      return "<!DOCTYPE html>\n<html>\n<head><meta charset=\"UTF-8\"></head>\n<body>\n"
        + editor.innerHTML + "\n</body>\n</html>";
    }
    return getPlainText();
  }

  /** 儲存檔案：寫入 localStorage 並更新虛擬狀態 */
  function saveFile() {
    saveToLocalStorage(false);
  }

  /** 開啟另存新檔對話框 */
  function openSaveAs() {
    document.getElementById("saveas-filename").value = state.fileName;
    document.getElementById("saveas-ext").value = state.fileExt;
    openModal(saveasModal);
  }

  /** 確認另存新檔：觸發瀏覽器下載 */
  function confirmSaveAs() {
    let name = document.getElementById("saveas-filename").value.trim();
    const ext = document.getElementById("saveas-ext").value;

    if (!name) {
      showToast("請輸入檔案名稱");
      return;
    }

    if (!name.includes(".")) {
      name += ext;
    }

    const dotIdx = name.lastIndexOf(".");
    const baseName = dotIdx > 0 ? name.slice(0, dotIdx) : name;
    const fileExt = dotIdx > 0 ? name.slice(dotIdx) : ext;

    const content = getSaveContent(fileExt);
    const mime = getMimeType(fileExt);
    downloadFile(name, content, mime);

    state.fileName = baseName;
    state.fileExt = fileExt;
    saveToLocalStorage(true);
    closeModal(saveasModal);
    showToast("已下載：" + name);
  }

  /** 一鍵複製全文（純文字，適用 LINE 等無法下載的瀏覽器） */
  async function copyAllText() {
    const text = getPlainText();

    if (!text) {
      showToast("目前沒有內容可複製");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("已複製全文至剪貼簿");
      return;
    } catch {
      // LINE 內建瀏覽器等環境的備援方案
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    document.body.removeChild(textarea);

    if (copied) {
      showToast("已複製全文至剪貼簿");
    } else {
      showToast("複製失敗，請使用「全選」後手動複製");
    }
  }

  // ===== 編輯功能 =====

  /** 執行 document.execCommand（復原、重做、格式化等） */
  function exec(cmd, value = null) {
    focusEditor();
    document.execCommand(cmd, false, value);
    markDirtyAndAutoSave();
  }

  /** 放大字體 */
  function fontLarger() {
    state.fontSize = Math.min(state.fontSize + 2, 32);
    editor.style.fontSize = state.fontSize + "px";
    markDirtyAndAutoSave();
    showToast("字體大小：" + state.fontSize + "px");
  }

  /** 縮小字體 */
  function fontSmaller() {
    state.fontSize = Math.max(state.fontSize - 2, 12);
    editor.style.fontSize = state.fontSize + "px";
    markDirtyAndAutoSave();
    showToast("字體大小：" + state.fontSize + "px");
  }

  /** 設定文字顏色 */
  function setTextColor(color) {
    exec("foreColor", color);
    showToast("已套用顏色");
  }

  /** 全選 */
  function selectAll() {
    exec("selectAll");
  }

  /** 複製選取內容 */
  async function copyText() {
    focusEditor();
    const selection = window.getSelection();
    const text = selection.toString();

    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        showToast("已複製");
      } catch {
        exec("copy");
        showToast("已複製");
      }
    } else {
      showToast("請先選取文字");
    }
  }

  /** 貼上剪貼簿內容 */
  async function pasteText() {
    focusEditor();
    try {
      const text = await navigator.clipboard.readText();
      exec("insertText", text);
      showToast("已貼上");
    } catch {
      exec("paste");
      showToast("已貼上");
    }
  }

  /** 刪除選取內容 */
  function deleteSelection() {
    const selection = window.getSelection();
    if (!selection.toString()) {
      showToast("請先選取要刪除的文字");
      return;
    }
    exec("delete");
    showToast("已刪除");
  }

  // ===== 尋找與取代 =====

  /** 清除所有尋找高亮 */
  function clearFindHighlights() {
    editor.querySelectorAll("mark.find-highlight").forEach((mark) => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  /** 在純文字中搜尋所有符合項目 */
  function findAllMatches(searchText, caseSensitive) {
    const content = getPlainText();
    const matches = [];
    if (!searchText) return matches;

    const haystack = caseSensitive ? content : content.toLowerCase();
    const needle = caseSensitive ? searchText : searchText.toLowerCase();

    let pos = 0;
    while (pos < haystack.length) {
      const idx = haystack.indexOf(needle, pos);
      if (idx === -1) break;
      matches.push(idx);
      pos = idx + (needle.length || 1);
    }
    return matches;
  }

  /** 將指定符合項目以高亮標記顯示 */
  function highlightMatchAtIndex(searchText, matchIndex, caseSensitive) {
    clearFindHighlights();

    const content = getPlainText();
    const matches = findAllMatches(searchText, caseSensitive);
    if (matches.length === 0) return false;

    const idx = ((matchIndex % matches.length) + matches.length) % matches.length;
    state.findIndex = idx;
    const start = matches[idx];
    const end = start + searchText.length;

    const before = content.slice(0, start);
    const match = content.slice(start, end);
    const after = content.slice(end);

    editor.innerHTML = "";
    editor.appendChild(document.createTextNode(before));

    const mark = document.createElement("mark");
    mark.className = "find-highlight";
    mark.textContent = match;
    editor.appendChild(mark);

    editor.appendChild(document.createTextNode(after));
    mark.scrollIntoView({ block: "center", behavior: "smooth" });

    showToast("第 " + (idx + 1) + " / " + matches.length + " 個符合");
    return true;
  }

  /** 尋找下一個 */
  function findNext() {
    const searchText = document.getElementById("find-input").value;
    const caseSensitive = document.getElementById("find-case").checked;

    if (!searchText) {
      showToast("請輸入尋找文字");
      return;
    }

    state.findMatches = findAllMatches(searchText, caseSensitive);
    if (state.findMatches.length === 0) {
      clearFindHighlights();
      showToast("找不到符合項目");
      return;
    }

    highlightMatchAtIndex(searchText, state.findIndex + 1, caseSensitive);
  }

  /** 尋找上一個 */
  function findPrev() {
    const searchText = document.getElementById("find-input").value;
    const caseSensitive = document.getElementById("find-case").checked;

    if (!searchText) {
      showToast("請輸入尋找文字");
      return;
    }

    state.findMatches = findAllMatches(searchText, caseSensitive);
    if (state.findMatches.length === 0) {
      clearFindHighlights();
      showToast("找不到符合項目");
      return;
    }

    highlightMatchAtIndex(searchText, state.findIndex - 1, caseSensitive);
  }

  /** 取代第一個符合項 */
  function replaceOne() {
    const searchText = document.getElementById("replace-find-input").value;
    const replaceText = document.getElementById("replace-with-input").value;
    const caseSensitive = document.getElementById("replace-case").checked;

    if (!searchText) {
      showToast("請輸入尋找文字");
      return;
    }

    const content = getPlainText();
    const flags = caseSensitive ? "" : "i";
    const regex = new RegExp(escapeRegex(searchText), flags);
    const newContent = content.replace(regex, replaceText);

    if (newContent === content) {
      showToast("找不到符合項目");
      return;
    }

    setPlainText(newContent);
    showToast("已取代 1 處");
  }

  /** 全部取代 */
  function replaceAll() {
    const searchText = document.getElementById("replace-find-input").value;
    const replaceText = document.getElementById("replace-with-input").value;
    const caseSensitive = document.getElementById("replace-case").checked;

    if (!searchText) {
      showToast("請輸入尋找文字");
      return;
    }

    const content = getPlainText();
    const flags = caseSensitive ? "g" : "gi";
    const regex = new RegExp(escapeRegex(searchText), flags);
    const matches = content.match(regex);
    const count = matches ? matches.length : 0;

    if (count === 0) {
      showToast("找不到符合項目");
      return;
    }

    setPlainText(content.replace(regex, replaceText));
    showToast("已取代 " + count + " 處");
  }

  /** 跳脫正規表示式特殊字元 */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ===== 選單動作分派 =====

  const actions = {
    "new": () => { closeAllSheets(); newFile(); },
    "open": () => { closeAllSheets(); openFile(); },
    "save": () => { closeAllSheets(); saveFile(); },
    "save-as": () => { closeAllSheets(); openSaveAs(); },
    "copy-all": () => { closeAllSheets(); copyAllText(); },
    "undo": () => { closeAllSheets(); exec("undo"); showToast("已復原"); },
    "redo": () => { closeAllSheets(); exec("redo"); showToast("已重做"); },
    "select-all": () => { closeAllSheets(); selectAll(); },
    "copy": () => { closeAllSheets(); copyText(); },
    "paste": () => { closeAllSheets(); pasteText(); },
    "delete": () => { closeAllSheets(); deleteSelection(); },
    "find": () => { closeAllSheets(); openModal(findModal); },
    "replace": () => { closeAllSheets(); openModal(replaceModal); },
    "bold": () => { exec("bold"); },
    "italic": () => { exec("italic"); },
    "underline": () => { exec("underline"); },
    "font-larger": () => { fontLarger(); },
    "font-smaller": () => { fontSmaller(); },
  };

  // ===== 事件綁定 =====

  document.getElementById("btn-file").addEventListener("click", () => openSheet(fileSheet));
  document.getElementById("btn-edit").addEventListener("click", () => openSheet(editSheet));

  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (actions[action]) actions[action]();
    });
  });

  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setTextColor(btn.dataset.color);
    });
  });

  document.querySelectorAll("[data-close-sheet]").forEach((el) => {
    el.addEventListener("click", closeAllSheets);
  });

  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => {
      closeModal(document.getElementById(el.dataset.closeModal));
    });
  });

  fileInput.addEventListener("change", handleFileOpen);

  // 輸入內容時自動背景存檔
  editor.addEventListener("input", markDirtyAndAutoSave);

  document.getElementById("find-next-btn").addEventListener("click", findNext);
  document.getElementById("find-prev-btn").addEventListener("click", findPrev);
  document.getElementById("replace-one-btn").addEventListener("click", replaceOne);
  document.getElementById("replace-all-btn").addEventListener("click", replaceAll);
  document.getElementById("saveas-confirm").addEventListener("click", confirmSaveAs);

  // 鍵盤快捷鍵（外接鍵盤時可用）
  document.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === "s") {
      e.preventDefault();
      saveFile();
    } else if (ctrl && e.key === "o") {
      e.preventDefault();
      openFile();
    } else if (ctrl && e.key === "n") {
      e.preventDefault();
      newFile();
    } else if (ctrl && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      exec("undo");
    } else if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      exec("redo");
    } else if (ctrl && e.key === "a") {
      e.preventDefault();
      selectAll();
    } else if (ctrl && e.key === "f") {
      e.preventDefault();
      openModal(findModal);
    } else if (ctrl && e.key === "h") {
      e.preventDefault();
      openModal(replaceModal);
    } else if (ctrl && e.key === "b") {
      e.preventDefault();
      exec("bold");
    } else if (ctrl && e.key === "i") {
      e.preventDefault();
      exec("italic");
    } else if (ctrl && e.key === "u") {
      e.preventDefault();
      exec("underline");
    }
  });

  // ===== 初始化：還原上次編輯內容 =====
  const restored = loadFromLocalStorage();
  updateTitle();
  focusEditor();

  if (restored) {
    showToast("已還原上次編輯內容");
  }

})();
