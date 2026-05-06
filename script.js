// ==========================================
// micro:bit FPVカー PWA メインコントロール
// UART改行対応 + micro:bit互換修正版
// ==========================================

let device = null;
let characteristic = null;
let connected = false;

let currentDirection = "STOP";
let currentSpeed = 2;

// ==========================================
// トリム値
// ==========================================
let leftTrim = 8;
let rightTrim = 0;

// ==========================================
// ジョイスティック
// ==========================================
let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };

// ==========================================
// カメラ
// ==========================================
let videoStream = null;

// ==========================================
// BLE UUID
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

        const server =
            await device.gatt.connect();

        const service =
            await server.getPrimaryService(
                SERVICE_UUID
            );

        characteristic =
            await service.getCharacteristic(
                CHARACTERISTIC_UUID
            );

        connected = true;

        updateConnectionStatus(true);

        device.addEventListener(
            "gattserverdisconnected",
            onDisconnected
        );

        showToast("Bluetooth接続成功");

        console.log("BLE connected");

    } catch (error) {

        console.error(error);

        showToast("接続失敗");
    }
}

// ==========================================
// 切断
// ==========================================
function onDisconnected() {

    connected = false;

    updateConnectionStatus(false);

    showToast("切断されました");
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
// ★ 改行付き（超重要）
// ==========================================
async function sendCommand(command) {

    if (!connected) return;

    if (!characteristic) return;

    try {

        const encoder =
            new TextEncoder();

        // ==================================
        // micro:bit UART用
        // 改行付き送信
        // ==================================
        await characteristic.writeValue(
            encoder.encode(command + "\n")
        );

        console.log("送信:", command);

    } catch (error) {

        console.error(
            "送信エラー:",
            error
        );
    }
}

// ==========================================
// スピード変更
// micro:bit互換 c10〜c14
// ==========================================
async function setSpeed(level) {

    currentSpeed = level;

    // c10〜c14
    const command = `c1${level}`;

    await sendCommand(command);

    // UI更新
    document.getElementById(
        "speedValue"
    ).textContent = level;

    document.getElementById(
        "speedBar"
    ).style.width =
        `${(level / 4) * 100}%`;
}

// ==========================================
// 方向制御
// ==========================================
async function setDirection(
    direction,
    isPress = true
) {

    if (!connected) return;

    // ======================================
    // STOP
    // ======================================
    if (direction === "STOP") {

        // micro:bit側停止命令
        await sendCommand("up");

        currentDirection = "STOP";

        return;
    }

    // ======================================
    // 押した
    // ======================================
    if (isPress) {

        await sendCommand(
            direction.toUpperCase()
        );

        currentDirection = direction;

    } else {

        // ==================================
        // 離した
        // ==================================
        await sendCommand(
            direction.toLowerCase()
        );

        currentDirection = "STOP";
    }
}

// ==========================================
// トリム表示更新
// ==========================================
function updateTrim() {

    document.getElementById(
        "leftTrimVal"
    ).textContent = leftTrim;

    document.getElementById(
        "rightTrimVal"
    ).textContent = rightTrim;
}

// ==========================================
// 接続状態表示
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
// カメラ開始
// ==========================================
async function startCamera() {

    try {

        videoStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {
                        facingMode: {
                            ideal: "environment"
                        }
                    }

                });

        const video =
            document.getElementById(
                "video"
            );

        video.srcObject = videoStream;

        document.getElementById(
            "videoOverlay"
        ).style.display = "none";

        showToast("カメラ起動");

    } catch (error) {

        console.error(error);

        showToast("カメラエラー");
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

    function start(clientX, clientY) {

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

        move(clientX, clientY);
    }

    function move(clientX, clientY) {

        if (!joystickActive) return;

        let dx =
            clientX -
            joystickCenter.x;

        let dy =
            clientY -
            joystickCenter.y;

        const max = 60;

        const dist =
            Math.sqrt(dx * dx + dy * dy);

        if (dist > max) {

            dx = dx / dist * max;

            dy = dy / dist * max;
        }

        thumb.style.transform =
            `translate(${dx}px, ${dy}px)`;

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

        if (dir !== currentDirection) {

            setDirection(dir, true);
        }
    }

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

            const t = e.touches[0];

            start(
                t.clientX,
                t.clientY
            );
        }
    );

    window.addEventListener(
        "touchmove",
        (e) => {

            if (!joystickActive) return;

            e.preventDefault();

            const t = e.touches[0];

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

            if (!joystickActive) return;

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

            setDirection(dir, true);
        }

        // 離した
        function release(e) {

            e.preventDefault();

            setDirection(dir, false);
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
        document.createElement("div");

    toast.textContent = message;

    toast.style.position = "fixed";
    toast.style.bottom = "100px";
    toast.style.left = "50%";
    toast.style.transform =
        "translateX(-50%)";

    toast.style.background =
        "rgba(0,0,0,0.8)";

    toast.style.color = "white";

    toast.style.padding =
        "10px 18px";

    toast.style.borderRadius =
        "20px";

    toast.style.zIndex = "9999";

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

    // trim
    const leftSlider =
        document.getElementById(
            "leftTrim"
        );

    const rightSlider =
        document.getElementById(
            "rightTrim"
        );

    leftSlider.addEventListener(
        "input",
        (e) => {

            leftTrim =
                parseInt(
                    e.target.value
                );

            updateTrim();
        }
    );

    rightSlider.addEventListener(
        "input",
        (e) => {

            rightTrim =
                parseInt(
                    e.target.value
                );

            updateTrim();
        }
    );

    document
        .getElementById(
            "resetTrim"
        )
        .addEventListener(
            "click",
            () => {

                leftTrim = 8;
                rightTrim = 0;

                leftSlider.value = 8;
                rightSlider.value = 0;

                updateTrim();

                showToast(
                    "トリムリセット"
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

    // service worker
    if (
        "serviceWorker"
        in navigator
    ) {

        navigator.serviceWorker
            .register("./sw.js");
    }

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
