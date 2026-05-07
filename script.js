<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>micro:bit FPV Car Controller</title>
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
</div>

<script>
    // ===============================
    // UUID（micro:bit UART）
    // ===============================
    const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
    const RX_CHARACTERISTIC = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";  // write
    // ===============================

    let device = null;
    let server = null;
    let characteristic = null;
    let connected = false;

    // UI Elements
    const statusLed = document.getElementById("statusLed");
    const statusText = document.getElementById("statusText");
    const connectBtn = document.getElementById("connectBtn");
    const disconnectBtn = document.getElementById("disconnectBtn");

    // 送信キュー（安定化）
    let queue = [];
    let sending = false;

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
    // 安定送信処理 (キュー + 遅延)
    // ===============================
    async function processQueue() {
        if (sending) return;
        if (queue.length === 0) return;
        if (!connected || !characteristic) {
            // 未接続ならキューをクリア
            queue = [];
            return;
        }

        sending = true;
        const cmd = queue.shift();

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(cmd);
            await characteristic.writeValueWithoutResponse(data);  // writeWithoutResponse が安定
            console.log("📤", cmd.trim());
        } catch (e) {
            console.warn("送信失敗:", e);
            // エラー時は接続断とみなす
            if (e.message && e.message.includes("GATT")) {
                connected = false;
                updateUI(false);
                characteristic = null;
            }
        }

        sending = false;
        // 次の送信まで少し待つ (micro:bit処理が追いつく)
        setTimeout(processQueue, 30);
    }

    function sendCommand(cmd) {
        if (!connected || !characteristic) return;
        queue.push(cmd + "\n");
        processQueue();
    }

    // ===============================
    // BLE接続 (完全再現＋遅延付き)
    // ===============================
    async function connectBLE() {
        if (connected) return;

        try {
            console.log("🔍 BLEデバイス検索開始...");
            // フィルタ: micro:bit の名前パターンまたは全てのデバイス
            device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: "micro:bit" },
                    { namePrefix: "BBC" }
                ],
                optionalServices: [UART_SERVICE]
            });

            console.log("✅ 選択:", device.name || device.id);

            // 切断イベント
            device.addEventListener("gattserverdisconnected", () => {
                console.log("🔌 BLE切断 (サーバー)");
                connected = false;
                characteristic = null;
                updateUI(false);
                queue = [];
                sending = false;
            });

            // GATT接続
            server = await device.gatt.connect();
            console.log("🔗 GATT接続OK");

            // サービス取得
            const service = await server.getPrimaryService(UART_SERVICE);
            console.log("📡 UARTサービス取得");

            // 書き込み characteristic (RX)
            characteristic = await service.getCharacteristic(RX_CHARACTERISTIC);
            console.log("✍️ 書き込みChar取得");

            // 接続成功フラグ
            connected = true;
            updateUI(true);

            // 少し待ってから初期化コマンドを送らない (micro:bit側が準備)
            console.log("🎮 コントロール準備完了");

            // 念のため停止コマンド
            setTimeout(() => {
                if (connected) {
                    sendCommand("up");
                    sendCommand("down");
                    sendCommand("left");
                    sendCommand("right");
                }
            }, 200);

        } catch (err) {
            console.error("❌ BLE接続エラー:", err);
            alert("接続失敗: " + (err.message || "Bluetooth対応端末か確認してね"));
            connected = false;
            updateUI(false);
            characteristic = null;
        }
    }

    // 切断処理
    function disconnectBLE() {
        if (device && device.gatt.connected) {
            device.gatt.disconnect();
        } else {
            connected = false;
            characteristic = null;
            updateUI(false);
        }
    }

    // ===============================
    // 十字キーバインド (リピート送信)
    // ===============================
    function bindPad(dir, pressCmd, releaseCmd) {
        const btn = document.querySelector(`[data-dir="${dir}"]`);
        if (!btn) return;

        let repeatInterval = null;

        function startSending() {
            if (!connected) return;
            // 最初の送信
            sendCommand(pressCmd);
            // リピート (200ms 毎)
            if (repeatInterval) clearInterval(repeatInterval);
            repeatInterval = setInterval(() => {
                if (connected) {
                    sendCommand(pressCmd);
                } else {
                    stopSending();
                }
            }, 200);
        }

        function stopSending() {
            if (repeatInterval) {
                clearInterval(repeatInterval);
                repeatInterval = null;
            }
            if (connected) {
                sendCommand(releaseCmd);
            }
        }

        // マウス・タッチ両対応
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
    // Speed スライダー
    // ===============================
    let speedDebounce = null;
    let lastSpeedCmd = "";

    function sendSpeed(value) {
        let level = parseInt(value, 10);
        // micro:bit側の speed_table 仕様に変換
        let mapped = 0;
        if (level === 0) mapped = 0;
        else if (level === 1) mapped = 4;
        else if (level === 2) mapped = 8;
        else if (level === 3) mapped = 12;
        else if (level === 4) mapped = 15;

        const cmd = "c" + String(mapped).padStart(2, "0");
        if (cmd === lastSpeedCmd) return;
        lastSpeedCmd = cmd;
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
        }, 100);
    });

    // STOP ボタン: 全停止を送信
    const stopBtn = document.querySelector('[data-dir="STOP"]');
    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            if (!connected) return;
            sendCommand("up");
            sendCommand("down");
            sendCommand("left");
            sendCommand("right");
        });
        // タッチでもclickで動くように
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

    // 接続ボタンイベント
    connectBtn.onclick = connectBLE;
    disconnectBtn.onclick = disconnectBLE;

    // 初期表示
    updateUI(false);

    // コンソールログ確認用
    console.log("PWA ready — 正しいCharacteristicで書き込み");
</script>
</body>
</html>
