import * as vscode from "vscode";

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "styles.css"));
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>Audit AI</title>
</head>
<body>
  <header>
    <div class="header-top">
      <h2>AUDIT AI</h2>
      <div style="display: flex; gap: 6px;">
        <button class="btn-secondary" id="new-chat-btn" style="padding: 4px 8px; font-size: 10.5px;">+ New</button>
        <button class="btn-secondary" id="history-toggle-btn" style="padding: 4px 8px; font-size: 10.5px;">📜 Chats</button>
      </div>
    </div>
  </header>

  <div class="history-panel" id="history-panel" style="display: none;">
    <h3>Previous Chats</h3>
    <div id="sessions-list-container">
      <!-- Dynamically filled sessions list -->
    </div>
  </div>

  <div id="chat-container">
    <!-- Messages will be dynamically rendered here -->
    <div class="message assistant" id="welcome-msg">
      Hello! I am Audit AI, your autonomous coding agent. Ask me to fix a bug, build a feature, or explore your workspace files!
    </div>
  </div>

  <div class="settings-panel" id="settings-panel">
    <div class="settings-section">
      <h3>API Keys</h3>
      <div class="key-input-group">
        <input type="password" id="openai-key-input" placeholder="OpenAI API Key (gpt-5.4)..." />
        <button class="btn-primary" id="save-openai-key-btn">Save</button>
      </div>
      <div style="font-size: 10px; margin-top: 2px; color: rgba(255,255,255,0.4)" id="openai-key-status">Key Status: Not set</div>
    </div>

    <div class="settings-section">
      <div class="key-input-group">
        <input type="password" id="zai-key-input" placeholder="Z.AI API Key (glm-4.7)..." />
        <button class="btn-primary" id="save-zai-key-btn">Save</button>
      </div>
      <div style="font-size: 10px; margin-top: 2px; color: rgba(255,255,255,0.4)" id="zai-key-status">Key Status: Not set</div>
    </div>

    <div class="settings-section">
      <h3>Approvals Required</h3>
      <label class="checkbox-row">
        <input type="checkbox" id="require-file-approval-chk" checked />
        File modifications
      </label>
      <label class="checkbox-row">
        <input type="checkbox" id="require-cmd-approval-chk" checked />
        Terminal commands
      </label>
    </div>
  </div>

  <div class="input-area">
    <div class="input-row">
      <textarea id="prompt-input" placeholder="Ask Audit AI to build/fix..."></textarea>
      <button class="send-btn" id="send-btn">
        <span id="send-btn-icon">➔</span>
      </button>
    </div>
    
    <div class="control-bar">
      <div style="display: flex; align-items: center; gap: 8px;">
        <select id="model-select" class="model-pill-select">
          <option value="openai-gpt-5-4-codex">GPT-5.4 Codex</option>
          <option value="zai-glm-4-7">GLM-4.7</option>
        </select>
        <div class="status-badge">
          <div class="status-indicator" id="status-indicator"></div>
          <span id="status-text">Idle</span>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <div class="settings-toggle" id="settings-toggle-btn">
          ⚙ Settings
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    
    // DOM Elements
    const chatContainer = document.getElementById("chat-container");
    const promptInput = document.getElementById("prompt-input");
    const sendBtn = document.getElementById("send-btn");
    const sendBtnIcon = document.getElementById("send-btn-icon");
    const modelSelect = document.getElementById("model-select");
    const settingsToggleBtn = document.getElementById("settings-toggle-btn");
    const settingsPanel = document.getElementById("settings-panel");
    const historyToggleBtn = document.getElementById("history-toggle-btn");
    const historyPanel = document.getElementById("history-panel");
    const newChatBtn = document.getElementById("new-chat-btn");
    const sessionsListContainer = document.getElementById("sessions-list-container");
    const statusIndicator = document.getElementById("status-indicator");
    const statusText = document.getElementById("status-text");

    const openaiKeyInput = document.getElementById("openai-key-input");
    const saveOpenaiKeyBtn = document.getElementById("save-openai-key-btn");
    const openaiKeyStatus = document.getElementById("openai-key-status");

    const zaiKeyInput = document.getElementById("zai-key-input");
    const saveZaiKeyBtn = document.getElementById("save-zai-key-btn");
    const zaiKeyStatus = document.getElementById("zai-key-status");

    const requireFileApprovalChk = document.getElementById("require-file-approval-chk");
    const requireCmdApprovalChk = document.getElementById("require-cmd-approval-chk");

    let isExecuting = false;
    let currentAssistantMsgBubble = null;
    let currentCmdStreamBlock = null;

    // Load initial settings
    vscode.postMessage({ type: "getSettings" });

    // Auto-expand textarea
    promptInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });

    // Enter sends, Shift+Enter adds newline
    promptInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitPrompt();
      }
    });

    sendBtn.addEventListener("click", submitPrompt);
    
    newChatBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "newChat" });
      historyPanel.style.display = "none";
    });

    historyToggleBtn.addEventListener("click", () => {
      if (historyPanel.style.display === "flex" || historyPanel.style.display === "block") {
        historyPanel.style.display = "none";
      } else {
        historyPanel.style.display = "block";
        settingsPanel.style.display = "none";
      }
    });

    settingsToggleBtn.addEventListener("click", () => {
      if (settingsPanel.style.display === "flex") {
        settingsPanel.style.display = "none";
      } else {
        settingsPanel.style.display = "flex";
        historyPanel.style.display = "none";
      }
    });

    // Save Keys
    saveOpenaiKeyBtn.addEventListener("click", () => {
      const key = openaiKeyInput.value.trim();
      if (key) {
        vscode.postMessage({ type: "saveApiKey", provider: "openai", apiKey: key });
        openaiKeyInput.value = "";
      } else {
        vscode.postMessage({ type: "deleteApiKey", provider: "openai" });
      }
    });

    saveZaiKeyBtn.addEventListener("click", () => {
      const key = zaiKeyInput.value.trim();
      if (key) {
        vscode.postMessage({ type: "saveApiKey", provider: "zai", apiKey: key });
        zaiKeyInput.value = "";
      } else {
        vscode.postMessage({ type: "deleteApiKey", provider: "zai" });
      }
    });

    // Approval Toggles
    const updateApprovals = () => {
      vscode.postMessage({
        type: "updateApprovalSettings",
        requireFileEditApproval: requireFileApprovalChk.checked,
        requireCommandApproval: requireCmdApprovalChk.checked
      });
    };
    requireFileApprovalChk.addEventListener("change", updateApprovals);
    requireCmdApprovalChk.addEventListener("change", updateApprovals);

    function submitPrompt() {
      if (isExecuting) {
        // Cancel if currently running
        vscode.postMessage({ type: "cancelExecution" });
        setExecutionState(false);
        return;
      }

      const prompt = promptInput.value.trim();
      if (!prompt) return;

      appendUserMessage(prompt);
      
      const modelId = modelSelect.value;
      vscode.postMessage({
        type: "submitPrompt",
        prompt: prompt,
        modelId: modelId
      });

      promptInput.value = "";
      promptInput.style.height = "38px";
      setExecutionState(true);
    }

    function setExecutionState(executing) {
      isExecuting = executing;
      if (executing) {
        statusIndicator.className = "status-indicator busy";
        statusText.innerText = "Thinking...";
        sendBtnIcon.innerHTML = "■";
        sendBtn.className = "send-btn btn-danger";
      } else {
        statusIndicator.className = "status-indicator";
        statusText.innerText = "Idle";
        sendBtnIcon.innerHTML = "➔";
        sendBtn.className = "send-btn";
        currentAssistantMsgBubble = null;
        currentCmdStreamBlock = null;
      }
    }

    function appendUserMessage(text) {
      const msgDiv = document.createElement("div");
      msgDiv.className = "message user";
      msgDiv.innerText = text;
      chatContainer.appendChild(msgDiv);
      scrollToBottom();
    }

    function ensureAssistantMsgBubble() {
      if (!currentAssistantMsgBubble) {
        currentAssistantMsgBubble = document.createElement("div");
        currentAssistantMsgBubble.className = "message assistant";
        chatContainer.appendChild(currentAssistantMsgBubble);
      }
      return currentAssistantMsgBubble;
    }

    function scrollToBottom() {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Message receiver from Extension Host
    window.addEventListener("message", event => {
      const message = event.data;
      
      switch (message.type) {
        case "settingsLoaded":
          const settings = message.settings;
          modelSelect.value = settings.selectedModel;
          requireFileApprovalChk.checked = settings.requireFileEditApproval;
          requireCmdApprovalChk.checked = settings.requireCommandApproval;
          
          openaiKeyStatus.innerText = settings.hasOpenAIKey ? "Key Status: ✓ Saved" : "Key Status: Not set";
          zaiKeyStatus.innerText = settings.hasZaiKey ? "Key Status: ✓ Saved" : "Key Status: Not set";
          break;

        case "assistantDelta":
          setExecutionState(true);
          const bubble = ensureAssistantMsgBubble();
          bubble.innerText += message.text;
          scrollToBottom();
          break;

        case "assistantMessage":
          const completeBubble = ensureAssistantMsgBubble();
          completeBubble.innerText = message.text;
          currentAssistantMsgBubble = null;
          scrollToBottom();
          break;

        case "actionPreview":
          renderActionPreview(message.action);
          break;

        case "actionResult":
          renderActionResult(message.result);
          break;

        case "commandOutput":
          renderCommandOutput(message.text);
          break;

        case "error":
          const errDiv = document.createElement("div");
          errDiv.className = "message assistant";
          errDiv.style.borderColor = "var(--vscode-errorForeground)";
          errDiv.style.borderLeft = "3px solid var(--vscode-errorForeground)";
          errDiv.innerText = "Error: " + message.message;
          chatContainer.appendChild(errDiv);
          setExecutionState(false);
          scrollToBottom();
          break;

        case "loopFinished":
          setExecutionState(false);
          break;

        case "sessionsLoaded":
          renderSessionsList(message.sessions, message.currentSessionId);
          break;

        case "loadSessionData":
          loadConversation(message.conversation);
          modelSelect.value = message.modelId;
          setExecutionState(false);
          break;
      }
    });

    function renderSessionsList(sessions, currentSessionId) {
      sessionsListContainer.innerHTML = "";
      if (sessions.length === 0) {
        sessionsListContainer.innerHTML = "<div style='font-size:11px; opacity:0.5; padding:6px;'>No previous chats</div>";
        return;
      }

      sessions.forEach(sess => {
        const item = document.createElement("div");
        item.className = "session-item" + (sess.id === currentSessionId ? " active" : "");
        
        const titleSpan = document.createElement("span");
        titleSpan.className = "session-title";
        titleSpan.innerText = sess.title || "Untitled Chat";
        titleSpan.onclick = () => {
          vscode.postMessage({ type: "loadSession", sessionId: sess.id });
        };
        
        const deleteBtn = document.createElement("span");
        deleteBtn.className = "session-delete-btn";
        deleteBtn.innerText = "✕";
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: "deleteSession", sessionId: sess.id });
        };
        
        item.appendChild(titleSpan);
        item.appendChild(deleteBtn);
        sessionsListContainer.appendChild(item);
      });
    }

    function loadConversation(conversation) {
      chatContainer.innerHTML = "";
      if (conversation.length === 0) {
        chatContainer.innerHTML = '<div class="message assistant" id="welcome-msg">Hello! I am Audit AI, your autonomous coding agent. Ask me to fix a bug, build a feature, or explore your workspace files!</div>';
      } else {
        conversation.forEach(msg => {
          if (msg.role === "user") {
            appendUserMessage(msg.content);
          } else if (msg.role === "assistant") {
            const bubble = document.createElement("div");
            bubble.className = "message assistant";
            bubble.innerText = msg.content;
            chatContainer.appendChild(bubble);
          } else if (msg.role === "system") {
            const sys = document.createElement("div");
            sys.className = "message system";
            sys.innerText = msg.content;
            chatContainer.appendChild(sys);
          }
        });
      }
      scrollToBottom();
    }

    function renderActionPreview(action) {
      const card = document.createElement("div");
      card.className = "action-card";
      card.id = "action-" + action.id;

      const header = document.createElement("div");
      header.className = "action-header " + action.type;
      header.innerText = action.type.replace("_", " ");
      card.appendChild(header);

      const body = document.createElement("div");
      body.className = "action-body";
      
      const summary = document.createElement("div");
      summary.className = "action-summary";
      summary.innerText = action.summary;
      body.appendChild(summary);

      if (action.path) {
        const pathEl = document.createElement("span");
        pathEl.className = "action-path";
        pathEl.innerText = action.path;
        body.appendChild(pathEl);
      }

      card.appendChild(body);

      if (action.type === "patch_file" && action.unifiedDiff) {
        const diffCont = document.createElement("div");
        diffCont.className = "diff-container";
        
        const lines = action.unifiedDiff.split("\\n");
        lines.forEach(l => {
          const lineEl = document.createElement("span");
          lineEl.className = "diff-line";
          if (l.startsWith("+")) {
            lineEl.className += " addition";
          } else if (l.startsWith("-")) {
            lineEl.className += " deletion";
          } else if (l.startsWith("@@")) {
            lineEl.className += " info";
          }
          lineEl.innerText = l;
          diffCont.appendChild(lineEl);
        });
        card.appendChild(diffCont);
      } else if (action.type === "write_file" && action.content) {
        const diffCont = document.createElement("div");
        diffCont.className = "diff-container";
        diffCont.innerText = action.content;
        card.appendChild(diffCont);
      } else if (action.type === "run_command" && action.command) {
        const cmdEl = document.createElement("pre");
        cmdEl.style.margin = "4px 0";
        cmdEl.style.fontSize = "11px";
        cmdEl.style.background = "#111";
        cmdEl.style.padding = "6px";
        cmdEl.style.borderRadius = "4px";
        cmdEl.style.color = "#8bdaff";
        cmdEl.innerText = action.command;
        card.appendChild(cmdEl);
      }

      const controls = document.createElement("div");
      controls.className = "action-controls";

      const approveBtn = document.createElement("button");
      approveBtn.className = "btn-primary";
      approveBtn.innerText = "Approve";
      approveBtn.onclick = () => {
        vscode.postMessage({ type: "approveAction", actionId: action.id });
        controls.innerHTML = "<span style='font-size: 11px; opacity:0.6;'>Approved. Waiting for outcome...</span>";
      };

      const rejectBtn = document.createElement("button");
      rejectBtn.className = "btn-secondary";
      rejectBtn.innerText = "Reject";
      rejectBtn.onclick = () => {
        vscode.postMessage({ type: "rejectAction", actionId: action.id });
        controls.innerHTML = "<span style='font-size: 11px; color: var(--vscode-errorForeground);'>Rejected.</span>";
      };

      controls.appendChild(approveBtn);
      controls.appendChild(rejectBtn);
      card.appendChild(controls);

      chatContainer.appendChild(card);
      scrollToBottom();
    }

    function renderActionResult(result) {
      const card = document.getElementById("action-" + result.actionId);
      if (card) {
        const controls = card.querySelector(".action-controls");
        if (controls) {
          controls.remove();
        }
        
        const outcome = document.createElement("div");
        outcome.style.fontSize = "11px";
        outcome.style.marginTop = "6px";
        outcome.style.padding = "6px";
        outcome.style.borderRadius = "4px";

        if (result.success) {
          outcome.style.background = "rgba(16, 185, 129, 0.1)";
          outcome.style.color = "#34d399";
          outcome.innerText = "✓ Action succeeded. Output captured.";
        } else {
          outcome.style.background = "rgba(239, 68, 68, 0.1)";
          outcome.style.color = "#f87171";
          outcome.innerText = "✗ Action failed: " + (result.error || "Unknown error");
        }
        
        card.appendChild(outcome);
      }
      currentCmdStreamBlock = null;
      scrollToBottom();
    }

    function renderCommandOutput(text) {
      if (!currentCmdStreamBlock) {
        currentCmdStreamBlock = document.createElement("div");
        currentCmdStreamBlock.className = "command-stream";
        chatContainer.appendChild(currentCmdStreamBlock);
      }
      
      currentCmdStreamBlock.innerText += text;
      if (currentCmdStreamBlock.innerText.length > 5000) {
        currentCmdStreamBlock.innerText = currentCmdStreamBlock.innerText.substring(currentCmdStreamBlock.innerText.length - 5000);
      }
      currentCmdStreamBlock.scrollTop = currentCmdStreamBlock.scrollHeight;
      scrollToBottom();
    }

    function getNonce() {
      return "${nonce}";
    }
  </script>
</body>
</html>`;
}

function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
