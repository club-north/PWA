// ==========================================
// micro:bit FPVカー PWA メインコントロール
// ==========================================

let device = null;
let characteristic = null;
let connected = false;
let currentDirection = "STOP";
let currentSpeed = 2;

// トリム値（micro:bitの値と合わせる）
let leftTrim = 8;
let rightTrim = 0;

// ジョイスティック関連
let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };
let joystickPos = { x: 0, y: 0 };

// カメラ関連
let videoStream = null;

// ==========================================
// Bluetooth 接続
// ==========================================
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

async function connectBluetooth() {
    try {
        device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: [SERVICE_UUID] },
                { namePrefix: "BBC micro:bit" }
            ],
            optionalServices: [SERVICE_UUID]
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
        
        connected = true;
        updateConnectionStatus(true);
        
        // 切断イベントの監視
        device.addEventListener('gattserverdisconnected', onDisconnected);
        
        console.log("Bluetooth接続成功!");
        showToast("接続しました！");
        
    } catch (error) {
        console.error("接続エラー:", error);
        showToast("接続に失敗しました: " + error.message);
    }
}

function onDisconnected() {
    connected = false;
    updateConnectionStatus(false);
    showToast("切断されました");
}

function disconnectBluetooth() {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
    connected = false;
    updateConnectionStatus(false);
}

async function sendCommand(command) {
    if (!connected || !characteristic) return;
    
    try {
        const encoder = new TextEncoder();
        await characteristic.writeValue(encoder.encode(command + "\n"));
        console.log("送信:", command);
    } catch (error) {
        console.error("送信エラー:", error);
    }
}

// ==========================================
// スピード変換（micro:bitのspeed_table対応）
// ==========================================
function getSpeedLevel(level) {
    // 0-4のレベルをそのまま送信
    return level;
}

// ==========================================
// 方向制御
// ==========================================
async function setDirection(direction, isPress = true) {
    if (!connected) return;
    
    if (direction === "STOP") {
        await sendCommand("stop");
        currentDirection = "STOP";
        updateDirectionDisplay("STOP");
        return;
    }
    
    if (isPress) {
        // 押した時：大文字のコマンド（走行）
        const command = direction.toUpperCase();
        await sendCommand(command);
        currentDirection = direction;
        updateDirectionDisplay(direction);
    } else {
        // 離した時：小文字のコマンド（停止）
        await sendCommand(direction.toLowerCase());
        currentDirection = "STOP";
        updateDirectionDisplay("STOP");
    }
}

// スピード変更
async function setSpeed(level) {
    currentSpeed = level;
    const speedVal = getSpeedLevel(level);
    // micro:bitのスピード設定コマンド "c" + 数字
    const command = `c${speedVal}`;
    await sendCommand(command);
    
    // UI更新
    document.getElementById('speedValue').textContent = level;
    const speedBar = document.getElementById('speedBar');
    speedBar.style.width = `${(level / 4) * 100}%`;
}

// トリム更新
async function updateTrim() {
    // トリム値は走行コマンドに含まれるので、ここではUI更新のみ
    document.getElementById('leftTrimVal').textContent = leftTrim;
    document.getElementById('rightTrimVal').textContent = rightTrim;
    
    // 現在動いている場合は即座に反映
    if (currentDirection !== "STOP") {
        await setDirection(currentDirection, true);
    }
}

// ==========================================
// UI更新
// ==========================================
function updateConnectionStatus(isConnected) {
    const statusLed = document.getElementById('statusLed');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    if (isConnected) {
        statusLed.classList.add('connected');
        statusText.textContent = '接続済み';
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
    } else {
        statusLed.classList.remove('connected');
        statusText.textContent = '未接続';
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
    }
}

function updateDirectionDisplay(direction) {
    // 方向表示はLEDでもいいけど、今回は割愛
    console.log("方向:", direction);
}

// ==========================================
// カメラ制御
// ==========================================
async function startCamera() {
    try {
        // 背面カメラ優先
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" } }
        });
        const video = document.getElementById('video');
        video.srcObject = videoStream;
        
        document.getElementById('videoOverlay').style.display = 'none';
        showToast("カメラ起動完了");
    } catch (error) {
        // 背面カメラがない場合
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({
                video: true
            });
            const video = document.getElementById('video');
            video.srcObject = videoStream;
            document.getElementById('videoOverlay').style.display = 'none';
            showToast("カメラ起動完了");
        } catch (err) {
            console.error("カメラエラー:", err);
            showToast("カメラが使えません");
        }
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        document.getElementById('videoOverlay').style.display = 'flex';
    }
}

// ==========================================
// ジョイスティック
// ==========================================
function initJoystick() {
    const base = document.getElementById('joystickBase');
    const thumb = document.getElementById('joystickThumb');
    
    const baseRect = base.getBoundingClientRect();
    joystickCenter = {
        x: baseRect.left + baseRect.width / 2,
        y: baseRect.top + baseRect.height / 2
    };
    
    function handleMove(clientX, clientY) {
        if (!joystickActive) return;
        
        let dx = clientX - joystickCenter.x;
        let dy = clientY - joystickCenter.y;
        
        // 半径制限
        const maxRadius = 60;
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance > maxRadius) {
            dx = dx / distance * maxRadius;
            dy = dy / distance * maxRadius;
        }
        
        // サムの位置更新
        thumb.style.transform = `translate(${dx}px, ${dy}px)`;
        
        // 方向判定（デッドゾーンあり）
        const deadzone = 20;
        let direction = "STOP";
        
        if (Math.abs(dx) > deadzone || Math.abs(dy) > deadzone) {
            if (Math.abs(dy) > Math.abs(dx)) {
                direction = dy < 0 ? "UP" : "DOWN";
            } else {
                direction = dx < 0 ? "LEFT" : "RIGHT";
            }
        }
        
        if (direction !== currentDirection) {
            setDirection(direction, true);
        }
    }
    
    function handleEnd() {
        joystickActive = false;
        thumb.style.transform = `translate(0px, 0px)`;
        setDirection("STOP", true);
    }
    
    // マウス/タッチイベント
    thumb.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        const rect = base.getBoundingClientRect();
        joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    });
    
    thumb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        joystickActive = true;
        const rect = base.getBoundingClientRect();
        joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        handleMove(e.clientX, e.clientY);
    });
    
    window.addEventListener('touchmove', (e) => {
        if (joystickActive) {
            e.preventDefault();
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
        }
    });
    
    window.addEventListener('mousemove', (e) => {
        if (joystickActive) {
            handleMove(e.clientX, e.clientY);
        }
    });
    
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mouseup', handleEnd);
}

// ==========================================
// 十字キー制御
// ==========================================
function initDpad() {
    const buttons = document.querySelectorAll('.dpad-btn');
    
    buttons.forEach(btn => {
        const direction = btn.dataset.dir;
        
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (direction === "STOP") {
                setDirection("STOP", true);
            } else {
                setDirection(direction, true);
            }
        });
        
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (direction === "STOP") {
                setDirection("STOP", true);
            } else {
                setDirection(direction, true);
            }
        });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (direction !== "STOP") {
                setDirection(direction, false);
            }
        });
        
        btn.addEventListener('mouseup', (e) => {
            if (direction !== "STOP") {
                setDirection(direction, false);
            }
        });
    });
}

// ==========================================
// トースト通知
// ==========================================
function showToast(message) {
    // 簡易トースト
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '100px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = 'white';
    toast.style.padding = '8px 16px';
    toast.style.borderRadius = '20px';
    toast.style.zIndex = '1000';
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// ==========================================
// 初期化
// ==========================================
function init() {
    // Bluetoothボタン
    document.getElementById('connectBtn').addEventListener('click', connectBluetooth);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectBluetooth);
    
    // スピードスライダー
    const speedSlider = document.getElementById('speedSlider');
    speedSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        setSpeed(val);
    });
    
    // トリム調整
    const leftTrimSlider = document.getElementById('leftTrim');
    const rightTrimSlider = document.getElementById('rightTrim');
    
    leftTrimSlider.addEventListener('input', (e) => {
        leftTrim = parseInt(e.target.value);
        updateTrim();
    });
    
    rightTrimSlider.addEventListener('input', (e) => {
        rightTrim = parseInt(e.target.value);
        updateTrim();
    });
    
    document.getElementById('resetTrim').addEventListener('click', () => {
        leftTrim = 8;
        rightTrim = 0;
        leftTrimSlider.value = 8;
        rightTrimSlider.value = 0;
        updateTrim();
        showToast("トリムをリセットしました");
    });
    
    // カメラ
    document.getElementById('startCamera').addEventListener('click', startCamera);
    
    // ジョイスティック
    initJoystick();
    
    // 十字キー
    initDpad();
    
    // PWAインストール
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');
    }
    
    console.log("初期化完了");
}

// ページ読み込み完了で開始
window.addEventListener('DOMContentLoaded', init);
