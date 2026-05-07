// ==========================================
// micro:bit FPVカー PWA
// Android Chrome + micro:bit 最終安定版
// script.js
// ==========================================

// ==========================================
// グローバル
// ==========================================
let device = null;
let characteristic = null;
let connected = false;

let currentDirection = "STOP";
let currentSpeed = 2;

let videoStream = null;

// ==========================================
// micro:bit BLE UART UUID
// ==========================================
const SERVICE_UUID =
    "6e400001-b5a3-f393-e0a9-e50e24dcca9e";

const RX_CHARACTERISTIC_UUID =
    "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

// ==========================================
// Bluetooth接続
// ==========================================
async function connectBluetooth() {

    try {

        // ==================================
        // device取得
        // ==================================
        device =
            await navigator.bluetooth.requestDevice({

                filters: [
                    {
                        services: [
                            SERVICE_UUID
                        ]
                    }
                ],

                optionalServices: [
                    SERVICE_UUID
                ]
            });

        console.log(
            "device取得"
        );

        // ==================================
        // GATT接続
        // ==================================
        const server =
            await device.gatt.connect();

        console.log(
            "GATT接続"
        );

        // ==================================
        // service取得
        // ==================================
        const service =
            await server.getPrimaryService(
                SERVICE_UUID
            );

        console.log(
            "service取得"
        );

        // ==================================
        // RX characteristic取得
        // ==================================
        characteristic =
            await service.getCharacteristic(
                RX_CHARACTERISTIC_UUID
            );

        console.log(
            "RX characteristic取得"
        );

        console.log(
            characteristic
        );

        console.log(
            "properties:",
            characteristic.properties
        );

        // ==================================
        // 接続成功
        // ==================================
        connected = true;

        updateConnectionStatus(true);

        console.log(
            "BLE接続成功"
        );

        showToast(
            "Bluetooth接続成功"
        );

        // ==================================
        // 切断監視
        // ==================================
        device.addEventListener(
            "gattserverdisconnected",
            onDisconnected
        );

        // ==================================
        // 初期速度送信
        // ==================================
        await setSpeed(
            currentSpeed
        );

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

    console.log(
        "BLE切断"
    );

    showToast(
        "切断されました"
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

        // ==================================
        // 改行付き
        // ==================================
        const data =
            encoder.encode(
                command + "\n"
            );

        // ==================================
        // micro:bit UART 安定版
        // ==================================
        await characteristic
            .writeValueWithoutResponse(
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
            "送信失敗"
        );
    }
}

// ==========================================
// 速度変更
// SPD:xx
// ==========================================
async function setSpeed(level) {

    currentSpeed = level;

    // micro:bit側速度
    const speedMap = [
        15,
        25,
        35,
        45,
        60
    ];

    const realSpeed =
        speedMap[level];

    // SPD形式
    const command =
        `SPD:${realSpeed}`;

    await sendCommand(
        command
    );

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

    // 同じ方向なら送らない
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

    console.log(
        "方向:",
        command
    );

    await sendCommand(
        command
    );
}

// ==========================================
// 接続状態UI
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
// カメラ起動
// ==========================================
async function startCamera() {

    try {

        videoStream =
            await navigator
                .mediaDevices
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

    let active = false;

    let centerX = 0;
    let centerY = 0;

    function start(x, y) {

        active = true;

        const rect =
            base.getBoundingClientRect();

        centerX =
            rect.left +
            rect.width / 2;

        centerY =
            rect.top +
            rect.height / 2;

        move(x, y);
    }

    function move(x, y) {

        if (!active) return;

        let dx =
            x - centerX;

        let dy =
            y - centerY;

        const max = 60;

        const dist =
            Math.sqrt(
                dx*dx + dy*dy
            );

        if (dist > max) {

            dx =
                dx / dist * max;

            dy =
                dy / dist * max;
        }

        thumb.style.transform =
            `translate(${dx}px, ${dy}px)`;

        let dir = "STOP";

        const dead = 20;

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

    function end() {

        active = false;

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

            if (!active) return;

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

            if (!active) return;

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

        function press(e) {

            e.preventDefault();

            setDirection(dir);
        }

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
// Toast
// ==========================================
function showToast(message) {

    const toast =
        document.createElement(
            "div"
        );

    toast.textContent =
        message;

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

    // Bluetooth
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
