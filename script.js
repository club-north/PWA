<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>micro:bit FPV Car Controller - 修正版</title>
    <style>
        * {
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
            font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 16px;
        }

        .container {
            max-width: 500px;
            width: 100%;
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border-radius: 56px;
            padding: 24px 20px 32px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.1);
        }

        .status-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #0f0f1a;
            padding: 12px 20px;
            border-radius: 60px;
            margin-bottom: 28px;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.2);
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .led {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #ff3333;
            box-shadow: 0 0 6px currentColor;
            transition: all 0.2s;
        }

        .led.connected {
            background: #33ff33;
            box-shadow: 0 0 10px #33ff33;
        }

        .status-text {
            color: white;
            font-weight: 600;
            letter-spacing: 1px;
        }

        button {
            background: #2c2c44;
            border: none;
            color: white;
            font-weight: bold;
            padding: 8px 20px;
            border-radius: 40px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        button:active {
            transform: scale(0.96);
        }

        button:disabled {
            opacity: 0.5;
            transform: none;
        }

        .connect-btn { background: #00a86b; }
        .disconnect-btn { background: #c41e3a; }

        .speed-panel {
            background: #0a0a12cc;
            border-radius: 48px;
            padding: 12px 20px;
            margin-bottom: 28px;
            backdrop-filter: blur(4px);
        }

        .speed-label {
            display: flex;
            justify-content: space-between;
            color: #ccc;
            font-size: 14px;
            margin-bottom: 10px;
        }

        input[type="range"] {
            width: 100%;
            height: 6px;
            -webkit-appearance: none;
            background: #2c2c44;
            border-radius: 10px;
            outline: none;
        }

        input[type="range"]:focus {
            outline: none;
        }

        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 24px;
            height: 24px;
            background: #00a86b;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 0 8px #00ffaa;
            border: 2px solid white;
        }

        .dpad {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 14px;
            max-width: 280px;
            margin: 20px auto;
        }

        .pad-btn {
            background: #1e1e32;
            border-radius: 60px;
            text-align: center;
            padding: 20px 0;
            font-size: 32px;
            font-weight: bold;
            color: white;
            cursor: pointer;
            transition: 0.05s linear;
            box-shadow: 0 8px 0 #0a0a12;
            border: 1px solid rgba(255,255,255,0.2);
            touch-action: manipulation;
        }

        .pad-btn:active {
            transform: translateY(4px);
            box-shadow: 0 2px 0 #0a0a12;
        }

        .stop-btn {
            background: #c41e3a;
            box-shadow: 0 8px 0 #6b0f1f;
        }

        .center-empty {
            visibility: hidden;
        }

        .info {
            text-align: center;
            color: #aaa;
            font-size: 12px;
            margin-top: 24px;
        }
        
        .debug {
            font-size: 10px;
            color: #888;
            text-align: center;
            margin-top: 12px;
            font-family: monospace;
        }
    </style>
</head>
<body>
<div class="container">
    <div class="status-bar">
        <div class="status-indicator">
            <div class="led" id="statusLed"></div>
            <span class="status-text" id="statusText">未接続</span>
        </div>
        <div>
            <button id="connectBtn" class="connect-btn">接続</button>
            <button id="disconnectBtn" class="disconnect-btn" disabled>切断</button>
        </div>
    </div>

    <div class="speed-panel">
        <div class="speed-label">
            <span>🐢 スピード</span>
            <span id="speedValue">2</span>
            <span>🐇</span>
        </div>
        <input type="range" id="speedSlider" min="0" max="4" step="1" value="2">
    </div>

    <div class="dpad">
        <div></div>
        <div class="pad-btn" data-dir="UP">▲</div>
        <div></div>
        <div class="pad-btn" data-dir="LEFT">◀</div>
        <div class="pad-btn" data-dir="STOP">■</div>
        <div class="pad-btn" data-dir="RIGHT">▶</div>
        <div></div>
        <div class="pad-btn" data-dir="DOWN">▼</div>
        <div></div>
    </div>
    <div class="info">
        ⚡ 押し続けると連続送信 | 停止ボタンで全停止
    </div>
    <div class="debug" id="debugInfo"></div>
</div>

<script>
    // ===============================
    // UUID（micro:bit UART - 正確な仕様）
    // ===============================
    const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
    const TX_CHARACTERISTIC = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";  // 書き込み用
    
    let device = null;
    let server = null;
    let writeCharacteristic = null;
    let connected = false;

    // UI Elements
    const statusLed = document.getElementById("statusLed");
    const statusText = document.getElementById("statusText");
    const connectBtn = document.getElementById("connectBtn");
    const disconnectBtn = document.getElementById("disconnectBtn");
    const debugInfo = document.getElementById("debugInfo");

    // 送信キュー
    let queue = [];
    let sending = false;

    // デバッグ表示
    function debugLog(msg) {
        console.log(msg);
        debugInfo.innerHTML = new Date().toLocaleTimeString() + " " + msg;
        setTimeout(() => {
            if (debugInfo.innerHTML.includes(msg)) {
                // 保持する
            }
        }, 3000);
    }

    // ===============================
    // UI更新
    // ===============================
    function updateUI(state) {
        if (state) {
            statusLed.classList.add("connected");
            statusText.textContent = "接続中";
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
        } else {
            statusLed.classList.remove("connected");
            statusText.textContent = "未接続";
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
        }
    }

    // ===============================
    // 送信関数 - writeValue を使用（writeWithoutResponseは許可されない場合がある）
    // ===============================
    async function writeToMicrobit(data) {
        if (!writeCharacteristic || !connected) {
            debugLog("❌ 書き込み不可: 未接続");
            return false;
        }
        
        try {
            // 重要な修正: writeValue を使用（writeWithoutResponseはmicro:bitで許可されない）
            await writeCharacteristic.writeValue(data);
            debugLog("✅ 送信成功: " + new TextDecoder().decode(data).trim());
            return true;
        } catch (e) {
            debugLog("❌ 送信エラー: " + e.message);
            console.error("Write error:", e);
            
            // エラー内容が"GATT operation not permitted"の場合
            if (e.message.includes("not permitted") || e.message.includes("GATT")) {
                debugLog("⚠️ 権限エラー - 再接続が必要かもしれません");
                // 接続状態をリセットしない（再接続はユーザー操作で）
            }
            return false;
        }
    }

    // キュー処理
    async function processQueue() {
        if (sending) return;
        if (queue.length === 0) return;
        if (!connected || !writeCharacteristic) {
            queue = [];
            return;
        }

        sending = true;
        const cmd = queue.shift();
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(cmd);
            const success = await writeToMicrobit(data);
            
            if (!success && cmd !== "up") {
                // エラー時は少し待ってからリトライしない（キューは処理済み）
                debugLog("⚠️ 送信失敗: " + cmd.trim());
            }
        } catch (e) {
            debugLog("❌ キュー送信例外: " + e.message);
        }

        sending = false;
        // 次の送信まで待機（micro:bitの処理速度に合わせる）
        setTimeout(processQueue, 50);
    }

    function sendCommand(cmd) {
        if (!connected || !writeCharacteristic) {
            debugLog("📦 未接続: コマンド破棄 " + cmd);
            return;
        }
        queue.push(cmd + "\n");
        debugLog("📝 キュー追加: " + cmd);
        processQueue();
    }

    // ===============================
    // BLE接続（正しい手順で）
    // ===============================
    async function connectBLE() {
        if (connected) {
            debugLog("既に接続済み");
            return;
        }

        try {
            debugLog("🔍 BLEデバイス検索中...");
            
            // micro:bitを確実に見つけるためのフィルター
            device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: "micro:bit" },
                    { namePrefix: "BBC" }
                ],
                optionalServices: [UART_SERVICE]
            });

            debugLog("✅ デバイス選択: " + (device.name || "Unknown"));

            // 切断イベント
            device.addEventListener("gattserverdisconnected", () => {
                debugLog("🔌 切断イベント発生");
                connected = false;
                writeCharacteristic = null;
                updateUI(false);
                queue = [];
                sending = false;
            });

            // GATT接続
            debugLog("🔗 GATT接続中...");
            server = await device.gatt.connect();
            debugLog("✅ GATT接続完了");

            // サービス取得
            debugLog("📡 サービス取得中...");
            const service = await server.getPrimaryService(UART_SERVICE);
            debugLog("✅ サービス取得成功");

            // 書き込み用Characteristic取得
            debugLog("✍️ Characteristic取得中...");
            writeCharacteristic = await service.getCharacteristic(TX_CHARACTERISTIC);
            debugLog("✅ 書き込みCharacteristic取得成功");
            
            // 特性を確認
            const properties = writeCharacteristic.properties;
            debugLog(`📊 Characteristic properties: write=${properties.write}, writeWithoutResponse=${properties.writeWithoutResponse}`);
            
            // 接続成功
            connected = true;
            updateUI(true);
            
            // 少し待ってから停止コマンドを送信（micro:bit準備完了待ち）
            setTimeout(() => {
                if (connected) {
                    debugLog("🛑 初期停止コマンド送信");
                    sendCommand("up");
                    sendCommand("down");
                    sendCommand("left");
                    sendCommand("right");
                }
            }, 500);
            
            debugLog("🎉 接続完了！操作可能です");

        } catch (err) {
            debugLog("❌ 接続エラー: " + err.message);
            console.error("BLE Error:", err);
            alert("接続失敗: " + (err.message || "Bluetoothを確認してください"));
            connected = false;
            writeCharacteristic = null;
            updateUI(false);
        }
    }

    // 切断処理
    function disconnectBLE() {
        debugLog("切断処理実行");
        if (device && device.gatt.connected) {
            device.gatt.disconnect();
        }
        connected = false;
        writeCharacteristic = null;
        updateUI(false);
        queue = [];
        sending = false;
        debugLog("切断完了");
    }

    // ===============================
    // 十字キーバインド
    // ===============================
    function bindPad(dir, pressCmd, releaseCmd) {
        const btn = document.querySelector(`[data-dir="${dir}"]`);
        if (!btn) return;

        let repeatInterval = null;
        let isPressed = false;

        function startSending() {
            if (!connected) {
                debugLog("未接続のため操作できません");
                return;
            }
            if (isPressed) return;
            isPressed = true;
            
            debugLog(`▶️ ${pressCmd} 開始`);
            sendCommand(pressCmd);
            
            if (repeatInterval) clearInterval(repeatInterval);
            repeatInterval = setInterval(() => {
                if (connected && isPressed) {
                    sendCommand(pressCmd);
                } else {
                    stopSending();
                }
            }, 180);
        }

        function stopSending() {
            if (!isPressed) return;
            isPressed = false;
            
            if (repeatInterval) {
                clearInterval(repeatInterval);
                repeatInterval = null;
            }
            
            if (connected) {
                debugLog(`⏹️ ${releaseCmd} 停止`);
                sendCommand(releaseCmd);
            }
        }

        btn.addEventListener("mousedown", startSending);
        btn.addEventListener("mouseup", stopSending);
        btn.addEventListener("mouseleave", stopSending);

        btn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            startSending();
        }, { passive: false });
        btn.addEventListener("touchend", stopSending);
        btn.addEventListener("touchcancel", stopSending);
    }

    // ===============================
    // スピードコントロール
    // ===============================
    let speedDebounce = null;
    let lastSpeedCmd = "";

    function sendSpeed(value) {
        let level = parseInt(value, 10);
        // micro:bit側の速度テーブルに合わせる
        let mapped = 0;
        if (level === 0) mapped = 0;
        else if (level === 1) mapped = 4;
        else if (level === 2) mapped = 8;
        else if (level === 3) mapped = 12;
        else if (level === 4) mapped = 15;
        
        const cmd = "c" + String(mapped).padStart(2, "0");
        if (cmd === lastSpeedCmd) return;
        lastSpeedCmd = cmd;
        debugLog(`⚡ 速度設定: ${level} → cmd=${cmd}`);
        sendCommand(cmd);
    }

    const speedSlider = document.getElementById("speedSlider");
    const speedValueSpan = document.getElementById("speedValue");

    speedSlider.addEventListener("input", (e) => {
        const val = e.target.value;
        speedValueSpan.textContent = val;
        if (speedDebounce) clearTimeout(speedDebounce);
        speedDebounce = setTimeout(() => {
            sendSpeed(val);
        }, 150);
    });

    // STOPボタン
    const stopBtn = document.querySelector('[data-dir="STOP"]');
    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            if (!connected) return;
            debugLog("🛑 緊急停止");
            sendCommand("up");
            sendCommand("down");
            sendCommand("left");
            sendCommand("right");
        });
        
        stopBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            if (!connected) return;
            sendCommand("up");
            sendCommand("down");
            sendCommand("left");
            sendCommand("right");
        }, { passive: false });
    }

    // ボタンバインド
    bindPad("UP", "UP", "up");
    bindPad("DOWN", "DOWN", "down");
    bindPad("LEFT", "LEFT", "left");
    bindPad("RIGHT", "RIGHT", "right");

    // イベント登録
    connectBtn.onclick = connectBLE;
    disconnectBtn.onclick = disconnectBLE;

    // 初期表示
    updateUI(false);
    debugLog("PWA起動完了 - 接続ボタンを押してください");
    
    // デバイスの準備状況を確認
    if (!navigator.bluetooth) {
        debugLog("⚠️ このブラウザはWeb Bluetoothをサポートしていません");
        alert("このブラウザはBluetoothに対応していません。ChromeまたはEdgeを使用してください。");
    }
</script>
</body>
</html>
