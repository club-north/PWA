// ==========================================
// micro:bit FPVカー PWA
// 完全安定版 script.js
// LOFI Control互換
// ==========================================

// ==========================================
// グローバル
// ==========================================
let device = null;
let characteristic = null;
let connected = false;

let currentDirection = "STOP";
let currentSpeed = 2;

// ジョイスティック
let joystickActive = false;

let joystickCenter = {
    x: 0,
    y: 0
};

// カメラ
let videoStream = null;

// ==========================================
// micro:bit BLE UART UUID
// ==========================================
const SERVICE_UUID =
    "6e400001-b5a3-f393-e0a9-e50e24dcca9e";

const CHARACTERISTIC_UUID =
    "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

// ==========================================
// Bluetooth接続
// ==========================================
async function connectBluetooth() {

    try {

        device =
            await navigator.bluetooth.requestDevice({

                acceptAllDevices: true,

                optionalServices: [
                    SERVICE_UUID
                ]

            });

        console.log("device取得");

        const server =
            await device.gatt.connect();

        console.log("GATT接続");

        const service =
            await server.getPrimaryService(
                SERVICE_UUID
            );

        console.log("service取得");

        characteristic =
            await service.getCharacteristic(
                CHARACTERISTIC_UUID
            );

        console.log("characteristic取得");

        connected = true;

        updateConnectionStatus(true);

        // 切断監視
        device.addEventListener(
            "gattserverdisconnected",
            onDisconnected
        );

        showToast(
            "Bluetooth接続成功"
        );

        console.log(
            "BLE接続成功"
        );

        // 初期速度送信
        setSpeed(currentSpeed);

    } catch(error) {

        console.error(
            "BLE接続失敗:",
            error
        );

        showToast(
            "Bluetooth接続失敗"
        );
    }
}

// ==========================================
// 切断
// ==========================================
function onDisconnected() {

    connected = false;

    updateConnectionStatus(false);

    showToast(
        "切断されました"
    );

    console.log(
        "BLE切断"
    );
}

function disconnectBluetooth() {

    if (
        device &&
        device.gatt.connected
    ) {

        device.gatt.disconnect();
    }

    connected = false;

    updateConnectionStatus(false);
}

// ==========================================
// UART送信
// 改行付き（超重要）
// ==========================================
async function sendCommand(command) {

    if (!connected) return;

    if (!characteristic) return;

    try {

        const encoder =
            new TextEncoder();

        const data =
            encoder.encode(
                command + "\n"
            );

        // ==================================
        // micro:bit BLE UART 安定版
        // ==================================
        await characteristic
            .writeValue(
                data
            );

        console.log(
            "送信成功:",
            command
        );

    } catch(error) {

        console.error(
            "送信エラー:",
            error
        );

        showToast(
            "送信エラー"
        );
    }
}

// ==========================================
// 速度変更
// SPD:xx
// ==========================================
async function setSpeed(level) {

    currentSpeed = level;

    const speedMap = [
        15,
        25,
        35,
        45,
        60
    ];

    const realSpeed =
        speedMap[level];

    const command =
        `SPD:${realSpeed}`;

    await sendCommand(command);

    // UI更新
    document.getElementById(
        "speedValue"
    ).textContent = level;

    document.getElementById(
        "speedBar"
    ).style.width =
        `${(level / 4) * 100}%`;

    console.log(
        "速度:",
        realSpeed
    );
}

// ==========================================
// 方向制御
// ==========================================
async function setDirection(direction) {

    if (!connected) return;

    // 同じ方向なら送信しない
    if (
        direction === currentDirection
    ) {
        return;
    }

    currentDirection = direction;

    let command = "S";

    switch(direction) {

        case "UP":
            command = "F";
            break;

        case "DOWN":
            command = "B";
            break;

        case "LEFT":
            command = "L";
            break;

        case "RIGHT":
            command = "R";
            break;

        default:
            command = "S";
    }

    await sendCommand(command);

    console.log(
        "方向:",
        command
    );
}

// ==========================================
// 接続表示
// ==========================================
function updateConnectionStatus(
    isConnected
) {

    const statusLed =
        document.getElementById(
            "statusLed"
        );

    const statusText =
        document.getElementById(
            "statusText"
        );

    const connectBtn =
        document.getElementById(
            "connectBtn"
        );

    const disconnectBtn =
        document.getElementById(
            "disconnectBtn"
        );

    if (isConnected) {

        statusLed.classList.add(
            "connected"
        );

        statusText.textContent =
            "接続済み";

        connectBtn.disabled = true;

        disconnectBtn.disabled = false;

    } else {

        statusLed.classList.remove(
            "connected"
        );

        statusText.textContent =
            "未接続";

        connectBtn.disabled = false;

        disconnectBtn.disabled = true;
    }
}

// ==========================================
// カメラ
// ==========================================
async function startCamera() {

    try {

        videoStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {
                        facingMode: {
                            ideal:
                            "environment"
                        }
                    }

                });

        const video =
            document.getElementById(
                "video"
            );

        video.srcObject =
            videoStream;

        document.getElementById(
            "videoOverlay"
        ).style.display =
            "none";

        showToast(
            "カメラ起動"
        );

    } catch(error) {

        console.error(
            "カメラエラー:",
            error
        );

        showToast(
            "カメラ使用不可"
        );
    }
}

// ==========================================
// ジョイスティック
// ==========================================
function initJoystick() {

    const base =
        document.getElementById(
            "joystickBase"
        );

    const thumb =
        document.getElementById(
            "joystickThumb"
        );

    // 開始
    function start(x, y) {

        joystickActive = true;

        const rect =
            base.getBoundingClientRect();

        joystickCenter = {

            x:
                rect.left +
                rect.width / 2,

            y:
                rect.top +
                rect.height / 2
        };

        move(x, y);
    }

    // 移動
    function move(x, y) {

        if (!joystickActive)
            return;

        let dx =
            x - joystickCenter.x;

        let dy =
            y - joystickCenter.y;

        const max = 60;

        const dist =
            Math.sqrt(
                dx*dx + dy*dy
            );

        // 半径制限
        if (dist > max) {

            dx =
                dx / dist * max;

            dy =
                dy / dist * max;
        }

        thumb.style.transform =
            `translate(${dx}px, ${dy}px)`;

        // デッドゾーン
        const dead = 20;

        let dir = "STOP";

        if (
            Math.abs(dx) > dead ||
            Math.abs(dy) > dead
        ) {

            if (
                Math.abs(dy) >
                Math.abs(dx)
            ) {

                dir =
                    dy < 0
                    ? "UP"
                    : "DOWN";

            } else {

                dir =
                    dx < 0
                    ? "LEFT"
                    : "RIGHT";
            }
        }

        setDirection(dir);
    }

    // 終了
    function end() {

        joystickActive = false;

        thumb.style.transform =
            "translate(0px,0px)";

        setDirection("STOP");
    }

    // touch
    thumb.addEventListener(
        "touchstart",
        (e) => {

            e.preventDefault();

            const t =
                e.touches[0];

            start(
                t.clientX,
                t.clientY
            );
        }
    );

    window.addEventListener(
        "touchmove",
        (e) => {

            if (!joystickActive)
                return;

            e.preventDefault();

            const t =
                e.touches[0];

            move(
                t.clientX,
                t.clientY
            );
        }
    );

    window.addEventListener(
        "touchend",
        end
    );

    // mouse
    thumb.addEventListener(
        "mousedown",
        (e) => {

            e.preventDefault();

            start(
                e.clientX,
                e.clientY
            );
        }
    );

    window.addEventListener(
        "mousemove",
        (e) => {

            if (!joystickActive)
                return;

            move(
                e.clientX,
                e.clientY
            );
        }
    );

    window.addEventListener(
        "mouseup",
        end
    );
}

// ==========================================
// 十字キー
// ==========================================
function initDpad() {

    const buttons =
        document.querySelectorAll(
            ".dpad-btn"
        );

    buttons.forEach((btn) => {

        const dir =
            btn.dataset.dir;

        // 押した
        function press(e) {

            e.preventDefault();

            setDirection(dir);
        }

        // 離した
        function release(e) {

            e.preventDefault();

            setDirection("STOP");
        }

        btn.addEventListener(
            "touchstart",
            press
        );

        btn.addEventListener(
            "mousedown",
            press
        );

        btn.addEventListener(
            "touchend",
            release
        );

        btn.addEventListener(
            "mouseup",
            release
        );
    });
}

// ==========================================
// トースト
// ==========================================
function showToast(message) {

    const toast =
        document.createElement(
            "div"
        );

    toast.textContent = message;

    toast.style.position =
        "fixed";

    toast.style.bottom =
        "100px";

    toast.style.left =
        "50%";

    toast.style.transform =
        "translateX(-50%)";

    toast.style.background =
        "rgba(0,0,0,0.8)";

    toast.style.color =
        "white";

    toast.style.padding =
        "10px 18px";

    toast.style.borderRadius =
        "20px";

    toast.style.zIndex =
        "9999";

    document.body.appendChild(
        toast
    );

    setTimeout(() => {

        toast.remove();

    }, 2000);
}

// ==========================================
// 初期化
// ==========================================
function init() {

    // BLE
    document
        .getElementById(
            "connectBtn"
        )
        .addEventListener(
            "click",
            connectBluetooth
        );

    document
        .getElementById(
            "disconnectBtn"
        )
        .addEventListener(
            "click",
            disconnectBluetooth
        );

    // speed
    document
        .getElementById(
            "speedSlider"
        )
        .addEventListener(
            "input",
            (e) => {

                setSpeed(
                    parseInt(
                        e.target.value
                    )
                );
            }
        );

    // camera
    document
        .getElementById(
            "startCamera"
        )
        .addEventListener(
            "click",
            startCamera
        );

    // joystick
    initJoystick();

    // dpad
    initDpad();

    console.log(
        "初期化完了"
    );
}

// ==========================================
// 起動
// ==========================================
window.addEventListener(
    "DOMContentLoaded",
    init
);
