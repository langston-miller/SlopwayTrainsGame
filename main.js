(function() {
        // Game Logic parameters
        let scene, camera, renderer;
        let p1Mesh, p2Mesh;
        let p1Lane = 1; 
        let p2Lane = 1; 
        const laneXPositions = [-3, 0, 3];
        
        let obstacles = []; 
        let score = 0;
        let sessionCoins = 0; 
        let gameActive = false;
        let isJumpscareActive = false;
        let isHugActive = false;
        let hugSphere = null;
        let hugTimer = 0;
        let menuState = "TITLE"; // TITLE, MODE_SELECT, COUNTDOWN, PLAYING, GAMEOVER, SHOP, SETTINGS, HUGGING
        
        let playerMode = 1; // 1 = 1P, 2 = 2P Mode
        let p1Dead = false;
        let p2Dead = false;
        let countdownCount = 3;
        let countdownTimer = 0;

        // Interactive items in 2P Mode
        let p1Item = null; // invincibility, wipe, coin_rush, freeze, reverse, slow, sabotage
        let p2Item = null;
        let p1InvincibilityTimer = 0;
        let p2InvincibilityTimer = 0;
        let p1FreezeTimer = 0;
        let p2FreezeTimer = 0;
        let p1ReverseTimer = 0;
        let p2ReverseTimer = 0;
        let p1SlowTimer = 0;
        let p2SlowTimer = 0;
        let coinRushTimer = 0;
        let sabotageRushTimer = 0;

        let p1ShieldVisual, p2ShieldVisual;
        let p1FreezeVisual, p2FreezeVisual;
        let tearParticles = [];

        const baseSpeed = 0.5;
        let currentSpeed = 0.5;
        let spawnTimer = 0;
        let deathCause = 'train'; // 'train', 'jumpscare', 'hug', 'p1_death', 'p2_death'
        let winnerNum = 0; // for 2P VS Mode ending

        // Audio synthesizer parameters
        let volumeLevel = localStorage.getItem('slop_volume') || 'high'; // high, medium, low, mute

        // Controller axis threshold debounce
        let p1GamepadAxisFlipped = false;
        let p2GamepadAxisFlipped = false;

        // Save Profiles
        let wallet = parseInt(localStorage.getItem('slop_coins')) || 0;
        let highScore = parseInt(localStorage.getItem('slop_highscore')) || 0;
        let unlockedSkins = JSON.parse(localStorage.getItem('slop_skins')) || { red: false, gold: false, emerald: false, obsidian: false, cyber: false };
        let activeSkin = localStorage.getItem('slop_activeskin') || 'grey';
        let jumpscaresEnabled = localStorage.getItem('slop_jumpscares') !== 'false';

        // Available Skins Schema
        const skinInventory = [
            { id: 'grey', name: 'Default Grey', color: 0x777777, cost: 0 },
            { id: 'red', name: 'Blood Tint', color: 0x990000, cost: 5 },
            { id: 'emerald', name: 'Emerald', color: 0x00cc66, cost: 10 },
            { id: 'gold', name: 'Gold Player', color: 0xffd700, cost: 15 },
            { id: 'obsidian', name: 'Obsidian Glow', color: 0x330066, cost: 25 },
            { id: 'cyber', name: 'Neon Cyber', color: 0x00ffff, cost: 30 }
        ];

        // Available items database
        const itemsList = [
            { id: 'invincibility', name: 'Invincibility', desc: 'Ignore hazards' },
            { id: 'wipe', name: 'Screen Wipe', desc: 'Clear paths' },
            { id: 'coin_rush', name: 'Coin Rush', desc: 'Convert hazards to coins' },
            { id: 'freeze', name: 'Ice Freeze', desc: 'Freeze opponent lanes' },
            { id: 'reverse', name: 'Reverser', desc: 'Reverse opponent controls' },
            { id: 'slow', name: 'Slowdown', desc: 'Suck opponent speed' },
            { id: 'sabotage', name: 'Sabotage', desc: 'Convert coins to spheres' }
        ];
        
        const container = document.getElementById('canvas-container');
        const uiScore = document.getElementById('game-ui');
        const hud2p = document.getElementById('hud-2p');
        const p1ScoreDisplay = document.getElementById('p1-score-display');
        const p2ScoreDisplay = document.getElementById('p2-score-display');
        const p1ItemSlot = document.getElementById('p1-item-slot');
        const p2ItemSlot = document.getElementById('p2-item-slot');

        const titleScreen = document.getElementById('title-screen');
        const titleStats = document.getElementById('title-stats');
        const modeSelectScreen = document.getElementById('mode-select-screen');
        const countdownScreen = document.getElementById('countdown-screen');
        const countdownText = document.getElementById('countdown-text');
        const gameOverScreen = document.getElementById('game-over-screen');
        const gameOverText = document.getElementById('game-over-text');
        const shopScreen = document.getElementById('shop-screen');
        const shopBalance = document.getElementById('shop-balance');
        const jumpscareScreen = document.getElementById('jumpscare-screen');
        const settingsScreen = document.getElementById('settings-screen');
        const v2screen = document.getElementById('v2-screen');

        // Helper to check volume multipliers
        function getVolumeMultiplier() {
            switch (volumeLevel) {
                case "medium":
                    return 0.5;
                case "low":
                    return 0.15;
                case "mute":
                    return 0;
                default:
                    return 1;
            }
        }

        function playSound(freq, duration, type = 'sine', slideTo = null) {
            const mult = getVolumeMultiplier();
            if (mult === 0) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const audioCtx = new AudioContext();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                if (slideTo) {
                    osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
                }
                gain.gain.setValueAtTime(0.3 * mult, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001 * mult, audioCtx.currentTime + duration);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + duration);
            } catch (e) {}
        }

        function playScarySound() {
            const mult = getVolumeMultiplier();
            if (mult === 0) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const audioCtx = new AudioContext();
                const o1 = audioCtx.createOscillator(); const g1 = audioCtx.createGain();
                o1.type = 'sawtooth'; o1.frequency.setValueAtTime(65, audioCtx.currentTime); 
                o1.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 1);
                
                const o2 = audioCtx.createOscillator(); const g2 = audioCtx.createGain();
                o2.type = 'square'; o2.frequency.setValueAtTime(900, audioCtx.currentTime);
                o2.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.8);

                g1.gain.setValueAtTime(0.9 * mult, audioCtx.currentTime); g2.gain.setValueAtTime(0.6 * mult, audioCtx.currentTime);
                o1.connect(g1); o2.connect(g2); g1.connect(audioCtx.destination); g2.connect(audioCtx.destination);
                o1.start(); o2.start(); o1.stop(audioCtx.currentTime + 1.0); o2.stop(audioCtx.currentTime + 1.0);
            } catch(e) {}
        }

        function playHugSound() {
            playSound(150, 0.8, 'triangle', 300);
        }

        function playItemUseSound(isHelpful) {
            if (isHelpful) {
                playSound(300, 0.4, 'sine', 600);
            } else {
                playSound(400, 0.5, 'sawtooth', 150);
            }
        }

        function playCollectSound() {
            playSound(523.25, 0.1, 'sine'); // C5
            setTimeout(() => playSound(659.25, 0.15, 'sine'), 100); // E5
        }

        function init3D() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x050505);
            scene.fog = new THREE.FogExp2(0x050505, 0.035);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 5, 8);
            camera.lookAt(0, 1, -2);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);

            scene.add(new THREE.AmbientLight(0x333333));
            const dl = new THREE.DirectionalLight(0xffffff, 0.8);
            dl.position.set(5, 10, 5); scene.add(dl);

            const trackGeo = new THREE.BoxGeometry(0.2, 0.1, 200);
            const trackMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
            for(let i = 0; i < 3; i++) {
                const rL = new THREE.Mesh(trackGeo, trackMat); rL.position.set(laneXPositions[i] - 0.8, -0.05, -80); scene.add(rL);
                const rR = new THREE.Mesh(trackGeo, trackMat); rR.position.set(laneXPositions[i] + 0.8, -0.05, -80); scene.add(rR);
            }

            // P1 Mesh (Default Grey / Configurable skin)
            p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.5 }));
            p1Mesh.position.set(laneXPositions[p1Lane], 0.6, 0);
            scene.add(p1Mesh);

            // P2 Mesh (Default Neon Purple / Pink block to distinguish)
            p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xff00bb, roughness: 0.5 }));
            p2Mesh.position.set(laneXPositions[p2Lane], 0.6, 0);
            p2Mesh.visible = false;
            scene.add(p2Mesh);

            // Setup Visual Effects for shields & freeze
            const shieldGeo = new THREE.SphereGeometry(1.0, 16, 16);
            const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.4 });
            p1ShieldVisual = new THREE.Mesh(shieldGeo, shieldMat);
            p1ShieldVisual.visible = false;
            p1Mesh.add(p1ShieldVisual);

            p2ShieldVisual = new THREE.Mesh(shieldGeo, shieldMat);
            p2ShieldVisual.visible = false;
            p2Mesh.add(p2ShieldVisual);

            const iceGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
            const iceMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.45 });
            p1FreezeVisual = new THREE.Mesh(iceGeo, iceMat);
            p1FreezeVisual.visible = false;
            p1Mesh.add(p1FreezeVisual);

            p2FreezeVisual = new THREE.Mesh(iceGeo, iceMat);
            p2FreezeVisual.visible = false;
            p2Mesh.add(p2FreezeVisual);
            
            updatePlayerMeshColor();
            updateJumpscareButtonText();
            updateVolumeButtonText();
            refreshMenuStats();
        }

        function updatePlayerMeshColor() {
            const skin = skinInventory.find(s => s.id === activeSkin);
            if (skin) {
                p1Mesh.material.color.setHex(skin.color);
            } else {
                p1Mesh.material.color.setHex(0x777777);
            }
        }

        function updateJumpscareButtonText() {
            const btn = document.getElementById('btn-jumpscare-toggle');
            btn.innerText = jumpscaresEnabled ? 'Enabled' : 'Disabled';
            btn.className = `btn ${jumpscaresEnabled ? 'btn-danger' : 'btn-secondary'}`;
        }

        function updateVolumeButtonText() {
            const btn = document.getElementById('btn-volume-toggle');
            btn.innerText = `Volume: ${volumeLevel.toUpperCase()}`;
        }

        function toggleJumpscares() {
            jumpscaresEnabled = !jumpscaresEnabled;
            localStorage.setItem('slop_jumpscares', jumpscaresEnabled);
            updateJumpscareButtonText();
        }

        function toggleVolume() {
            switch (volumeLevel) {
                case "high":
                    volumeLevel = "medium";
                case "medium":
                    volumeLevel = "low";
                case "low":
                    volumeLevel = "mute";
                default:
                    volumeLevel = "high";
            }

            localStorage.setItem('slop_volume', volumeLevel);
            updateVolumeButtonText();
        }

        function refreshMenuStats() {
            titleStats.innerHTML = `HIGH SCORE: ${highScore}<br>TOTAL COINS: ${wallet}`;
        }

        function showTitleScreen() {
            menuState = "TITLE"; refreshMenuStats();
            titleScreen.style.display = 'flex'; 
            gameOverScreen.style.display = 'none'; 
            shopScreen.style.display = 'none'; 
            settingsScreen.style.display = 'none'; 
            v2screen.style.display = 'none';
            modeSelectScreen.style.display = 'none';
            countdownScreen.style.display = 'none';
            uiScore.style.display = 'none';
            hud2p.style.display = 'none';
            p2Mesh.visible = false;
        }

        function openShop() {
            menuState = "SHOP"; titleScreen.style.display = 'none'; shopScreen.style.display = 'flex'; renderShopInterface();
        }

        function openSettings() {
            menuState = "SETTINGS"; titleScreen.style.display = 'none'; settingsScreen.style.display = 'flex';
        }

        function openV2Info() {
            menuState = "V2-INFO"; titleScreen.style.display = 'none'; v2screen.style.display = 'flex';
        }

        function showModeSelect() {
            menuState = "MODE_SELECT";
            titleScreen.style.display = 'none';
            modeSelectScreen.style.display = 'flex';
        }

        function renderShopInterface() {
            shopBalance.innerText = `Your Coins: ${wallet}`;
            const container = document.getElementById('shop-items-container');
            container.innerHTML = '';

            skinInventory.forEach((skin) => {
                const itemDiv = document.createElement('div');
                const isBought = skin.cost === 0 || unlockedSkins[skin.id];
                itemDiv.className = `shop-item ${isBought ? 'bought' : ''}`;
                
                const hexColorStr = `#${skin.color.toString(16).padStart(6, '0')}`;
                let buttonText = `Buy [${skin.cost}]`;
                if (isBought) {
                    buttonText = activeSkin === skin.id ? "Equipped" : "Equip";
                }

                itemDiv.innerHTML = `
                    <div>
                        <div class="preview-box" style="background-color: ${hexColorStr}; margin: 0 auto 10px auto;"></div>
                        <h3 style="margin: 5px 0; font-size: 1rem;">${skin.name}</h3>
                        <p style="margin: 0; font-size: 0.8rem; color: #888;">${skin.cost > 0 ? 'Cost: ' + skin.cost : 'Default'}</p>
                    </div>
                    <button class="btn" id="buy-action-${skin.id}">${buttonText}</button>
                `;
                container.appendChild(itemDiv);

                document.getElementById(`buy-action-${skin.id}`).addEventListener('click', () => {
                    handleShopInput(skin.id);
                });
            });
        }

        function handleShopInput(skinId) {
            const skin = skinInventory.find(s => s.id === skinId);
            if (!skin) return;

            const isBought = skin.cost === 0 || unlockedSkins[skinId];
            if (!isBought) {
                if (wallet >= skin.cost) {
                    wallet -= skin.cost;
                    unlockedSkins[skinId] = true;
                    activeSkin = skinId;
                    playCollectSound();
                }
            } else {
                activeSkin = activeSkin === skinId ? 'grey' : skinId;
            }

            localStorage.setItem('slop_coins', wallet); 
            localStorage.setItem('slop_skins', JSON.stringify(unlockedSkins)); 
            localStorage.setItem('slop_activeskin', activeSkin);
            updatePlayerMeshColor(); 
            renderShopInterface();
        }

        function confirmWipeData() {
            document.getElementById('confirm-modal').style.display = 'flex';
        }

        function closeWipeModal() {
            document.getElementById('confirm-modal').style.display = 'none';
        }

        function executeWipeData() {
            localStorage.clear();
            wallet = 0;
            highScore = 0;
            unlockedSkins = { red: false, gold: false, emerald: false, obsidian: false, cyber: false };
            activeSkin = 'grey';
            jumpscaresEnabled = true;
            volumeLevel = 'high';
            
            updatePlayerMeshColor();
            updateJumpscareButtonText();
            updateVolumeButtonText();
            closeWipeModal();
            showTitleScreen();
        }

        function selectMode(count) {
            playerMode = count;
            modeSelectScreen.style.display = 'none';
            gameOverScreen.style.display = 'none'; // Hide results screen overlay during countdown & restarts
            
            // Wipe out tear animation and visual states
            tearParticles.forEach(p => scene.remove(p.mesh));
            tearParticles = [];
            p1ShieldVisual.visible = false;
            p2ShieldVisual.visible = false;
            p1FreezeVisual.visible = false;
            p2FreezeVisual.visible = false;

            if (playerMode === 1) {
                p2Mesh.visible = false;
                startGame();
            } else {
                p2Mesh.visible = true;
                p1Lane = 0;
                p2Lane = 2;
                p1Mesh.position.x = laneXPositions[p1Lane];
                p2Mesh.position.x = laneXPositions[p2Lane];
                p1Mesh.position.z = 0;
                p2Mesh.position.z = -1.5; // Offset slightly back to prevent clipping/overlapping visual clutter
                
                // Open Countdown
                menuState = "COUNTDOWN";
                countdownScreen.style.display = 'flex';
                countdownCount = 3;
                countdownTimer = 0;
                countdownText.innerText = countdownCount;
                playSound(440, 0.2, 'sine'); // A4 beep
            }
        }

        function runCountdown(dt) {
            countdownTimer += dt;
            if (countdownTimer >= 1.0) {
                countdownTimer = 0;
                countdownCount--;
                if (countdownCount > 0) {
                    countdownText.innerText = countdownCount;
                    playSound(440, 0.2, 'sine');
                } else if (countdownCount === 0) {
                    countdownText.innerText = "GO!";
                    playSound(880, 0.4, 'sine');
                } else {
                    countdownScreen.style.display = 'none';
                    startGame();
                }
            }
        }

        function startGame() {
            obstacles.forEach(obs => scene.remove(obs.mesh)); obstacles = [];
            score = 0; sessionCoins = 0; currentSpeed = baseSpeed;
            
            p1Dead = false;
            p2Dead = false;

            // Reset Item economy
            p1Item = null; p2Item = null;
            p1InvincibilityTimer = 0; p2InvincibilityTimer = 0;
            p1FreezeTimer = 0; p2FreezeTimer = 0;
            p1ReverseTimer = 0; p2ReverseTimer = 0;
            p1SlowTimer = 0; p2SlowTimer = 0;
            coinRushTimer = 0; sabotageRushTimer = 0;

            p1ShieldVisual.visible = false;
            p2ShieldVisual.visible = false;
            p1FreezeVisual.visible = false;
            p2FreezeVisual.visible = false;

            // Restore camera back to default gameplay running view
            camera.position.set(0, 5, 8);
            camera.lookAt(0, 1, -2);

            if (playerMode === 1) {
                p1Lane = 1;
                p1Mesh.position.x = laneXPositions[p1Lane];
                p1Mesh.position.z = 0;
                p1Mesh.position.y = 0.6;
                p1Mesh.rotation.set(0, 0, 0);
                uiScore.style.display = 'block';
                hud2p.style.display = 'none';
                updateUIScore();
            } else {
                p1Lane = 0; p2Lane = 2;
                p1Mesh.position.x = laneXPositions[p1Lane];
                p2Mesh.position.x = laneXPositions[p2Lane];
                p1Mesh.position.z = 0;
                p2Mesh.position.z = -1.5;
                p1Mesh.position.y = 0.6;
                p2Mesh.position.y = 0.6;
                p1Mesh.rotation.set(0, 0, 0);
                p2Mesh.rotation.set(0, 0, 0);
                
                uiScore.style.display = 'none';
                hud2p.style.display = 'flex';
                update2pHUD();
            }

            menuState = "PLAYING"; 
            titleScreen.style.display = 'none'; 
            gameOverScreen.style.display = 'none'; 
            jumpscareScreen.style.display = 'none';
            gameActive = true; 
            isJumpscareActive = false; 
            isHugActive = false;
        }

        function updateUIScore() { uiScore.innerHTML = `SCORE: ${score}<br>COINS: ${sessionCoins}`; }

        function update2pHUD() {
            p1ScoreDisplay.innerText = `Score: ${score}`;
            p2ScoreDisplay.innerText = `Score: ${score}`;
            p1ItemSlot.innerText = `ITEM: ${p1Item ? p1Item.name.toUpperCase() : 'NONE'} (Q)`;
            p2ItemSlot.innerText = `ITEM: ${p2Item ? p2Item.name.toUpperCase() : 'NONE'} (U)`;
            p1ItemSlot.style.color = p1Item ? '#00ffcc' : '#ffaa00';
            p2ItemSlot.style.color = p2Item ? '#ff55bb' : '#ffaa00';
        }

        function triggerGameOver(isScary = false, cause = 'train') {
            gameActive = false; 
            uiScore.style.display = 'none';
            hud2p.style.display = 'none';
            deathCause = cause;

            if (menuState !== "HUGGING") {
                menuState = "GAMEOVER";
            }
            
            wallet += sessionCoins; localStorage.setItem('slop_coins', wallet);
            if (score > highScore) { highScore = score; localStorage.setItem('slop_highscore', highScore); }

            // Move players to a podium area to ensure they are fully visible
            if (playerMode === 2) {
                p1Mesh.position.set(-1.5, 0.6, -5);
                p2Mesh.position.set(1.5, 0.6, -5);
                p1Mesh.rotation.set(0, 0, 0);
                p2Mesh.rotation.set(0, 0, 0);
                p1Mesh.visible = true;
                p2Mesh.visible = true;

                // Position camera to frame the podium perfectly
                camera.position.set(0, 2.2, -1.5);
                camera.lookAt(0, 0.8, -5);
            }

            if (isScary) {
                isJumpscareActive = true; jumpscareScreen.style.display = 'flex'; playScarySound();
                setTimeout(() => { jumpscareScreen.style.display = 'none'; isJumpscareActive = false; menuState = "GAMEOVER"; showGameOverPrompt(); }, 1000);
            } else {
                if (menuState !== "HUGGING") {
                    menuState = "GAMEOVER";
                }
                showGameOverPrompt();
            }
        }

        function showGameOverPrompt() {
            let messageText = "";
            if (playerMode === 1) {
                if (deathCause === 'train') messageText = "You got hit by a train.";
                else if (deathCause === 'jumpscare') messageText = "You got jumpscared.";
                else if (deathCause === 'hug') messageText = "You got hugged.";
            } else {
                // 2 Players ending prompt details
                if (winnerNum === 1) {
                    messageText = "PLAYER 1 WINS!\nPlayer 2 collided with a hazard.";
                } else if (winnerNum === 2) {
                    messageText = "PLAYER 2 WINS!\nPlayer 1 collided with a hazard.";
                }
            }

            gameOverText.innerHTML = `
                <div style="font-size: 1.5rem; color: #ff55bb; font-weight: bold; margin-bottom: 25px; text-shadow: 0 0 10px rgba(255, 85, 187, 0.5); white-space: pre-line;">${messageText}</div>
                Game Over!<br><br>Your Score: ${score}<br>Play Again? (Y/N)
            `;
            gameOverScreen.style.display = 'flex';
        }

        function spawnObstacle() {
            spawnTimer++;
            if (spawnTimer > 25) {
                spawnTimer = 0; 
                const proposedLane = Math.floor(Math.random() * 3); 
                const typeRand = Math.random();
                let type, mesh;

                // Spawner safety director checking for horizontal softlocks
                const windowBlockers = obstacles.filter(obs => 
                    (obs.type === 'train' || obs.type === 'sphere') && 
                    obs.mesh.position.z >= -135 && 
                    obs.mesh.position.z <= -105
                );

                const blockedLanes = new Set(windowBlockers.map(obs => obs.lane));
                let isBlocker = typeRand < 0.40 || (typeRand >= 0.75 && typeRand < 0.90);

                if (isBlocker) {
                    blockedLanes.add(proposedLane);
                    if (blockedLanes.size >= 3) {
                        isBlocker = false; // Demote blocker to a coin or item box to prevent impossible maps
                    }
                }

                if (isBlocker) {
                    // Sabotage rush turns objects to spheres
                    if (sabotageRushTimer > 0 || typeRand >= 0.75) {
                        type = 'sphere'; mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
                        mesh.position.set(laneXPositions[proposedLane], 0.6, -120);
                    } else {
                        type = 'train'; const length = 6 + Math.random() * 8;
                        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, length), new THREE.MeshStandardMaterial({ color: 0x1c3d5a, roughness: 0.3 }));
                        mesh.position.set(laneXPositions[proposedLane], 1.0, -120 - (length/2)); mesh.userData = { length: length };
                    }
                } else {
                    // Coin or item box
                    if (playerMode === 2 && Math.random() < 0.35) {
                        // Spawning floating interactive item box
                        type = 'item';
                        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.2, metalness: 0.5 }));
                        mesh.position.set(laneXPositions[proposedLane], 0.8, -120);
                    } else {
                        // Regular Coin
                        type = 'coin'; 
                        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.1 }));
                        mesh.rotation.x = Math.PI / 2; mesh.position.set(laneXPositions[proposedLane], 0.6, -120);
                    }
                }

                scene.add(mesh); 
                obstacles.push({ type, mesh, lane: proposedLane });
            }
        }

        function collectItem(playerNum) {
            playCollectSound();
            const randomItem = itemsList[Math.floor(Math.random() * itemsList.length)];
            if (playerNum === 1) {
                p1Item = randomItem;
            } else {
                p2Item = randomItem;
            }
            update2pHUD();
        }

        function useItem(playerNum) {
            const item = playerNum === 1 ? p1Item : p2Item;
            if (!item) return;

            const isHelpful = ['invincibility', 'wipe', 'coin_rush'].includes(item.id);
            playItemUseSound(isHelpful);

            if (item.id === 'invincibility') {
                if (playerNum === 1) { p1InvincibilityTimer = 5.0; p1ShieldVisual.visible = true; }
                else { p2InvincibilityTimer = 5.0; p2ShieldVisual.visible = true; }
            } 
            else if (item.id === 'wipe') {
                // Clear all blocker obstacles
                obstacles.forEach(obs => {
                    if (obs.type === 'train' || obs.type === 'sphere') {
                        scene.remove(obs.mesh);
                    }
                });
                obstacles = obstacles.filter(obs => obs.type === 'coin' || obs.type === 'item');
            } 
            else if (item.id === 'coin_rush') {
                coinRushTimer = 4.0;
                obstacles.forEach(obs => {
                    if (obs.type === 'train' || obs.type === 'sphere') {
                        scene.remove(obs.mesh);
                        obs.type = 'coin';
                        obs.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.1 }));
                        obs.mesh.rotation.x = Math.PI / 2;
                        obs.mesh.position.set(laneXPositions[obs.lane], 0.6, obs.mesh.position.z);
                        scene.add(obs.mesh);
                    }
                });
            } 
            else if (item.id === 'freeze') {
                // freeze opponent
                if (playerNum === 1) { p2FreezeTimer = 2.0; p2FreezeVisual.visible = true; }
                else { p1FreezeTimer = 2.0; p1FreezeVisual.visible = true; }
            } 
            else if (item.id === 'reverse') {
                // reverse opponent controls
                if (playerNum === 1) p2ReverseTimer = 5.0;
                else p1ReverseTimer = 5.0;
            } 
            else if (item.id === 'slow') {
                // slow opponent lanes down
                if (playerNum === 1) p2SlowTimer = 4.0;
                else p1SlowTimer = 4.0;
            } 
            else if (item.id === 'sabotage') {
                // Convert opponent potential path coins to hazard spheres
                sabotageRushTimer = 4.0;
                obstacles.forEach(obs => {
                    if (obs.type === 'coin') {
                        scene.remove(obs.mesh);
                        obs.type = 'sphere';
                        obs.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
                        obs.mesh.position.set(laneXPositions[obs.lane], 0.6, obs.mesh.position.z);
                        scene.add(obs.mesh);
                    }
                });
            }

            if (playerNum === 1) p1Item = null;
            else p2Item = null;
            update2pHUD();
        }

        function spawnTear(x, y, z) {
            const tearGeo = new THREE.SphereGeometry(0.12, 0.12, 0.12);
            const tearMat = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.7 });
            const mesh = new THREE.Mesh(tearGeo, tearMat);
            mesh.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.3, z);
            scene.add(mesh);
            tearParticles.push({
                mesh: mesh,
                vy: 0.05 + Math.random() * 0.05,
                vx: (Math.random() - 0.5) * 0.04,
                life: 1.0
            });
        }

        function updateTears(dt) {
            for (let i = tearParticles.length - 1; i >= 0; i--) {
                const t = tearParticles[i];
                t.mesh.position.y -= t.vy;
                t.mesh.position.x += t.vx;
                t.vy += 0.01; // simulate simple gravity
                t.life -= dt;
                if (t.mesh.position.y <= 0.1 || t.life <= 0) {
                    scene.remove(t.mesh);
                    tearParticles.splice(i, 1);
                }
            }
        }

        function pollGamepads() {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            
            // Player 1 controls (uses Gamepad index 0)
            const gp1 = gamepads[0];
            if (gp1) {
                const axisX = gp1.axes[0];
                const dpadLeft = gp1.buttons[14] && gp1.buttons[14].pressed;
                const dpadRight = gp1.buttons[15] && gp1.buttons[15].pressed;

                if (gameActive) {
                    let moveLeft = (axisX < -0.5 || dpadLeft);
                    let moveRight = (axisX > 0.5 || dpadRight);

                    if (p1ReverseTimer > 0) {
                        // Reverse P1 directions
                        const temp = moveLeft; moveLeft = moveRight; moveRight = temp;
                    }

                    if (p1FreezeTimer <= 0) {
                        if (moveLeft && !p1GamepadAxisFlipped && p1Lane > 0) {
                            p1Lane--; p1Mesh.position.x = laneXPositions[p1Lane]; p1GamepadAxisFlipped = true;
                        } else if (moveRight && !p1GamepadAxisFlipped && p1Lane < 2) {
                            p1Lane++; p1Mesh.position.x = laneXPositions[p1Lane]; p1GamepadAxisFlipped = true;
                        } else if (Math.abs(axisX) < 0.2 && !dpadLeft && !dpadRight) {
                            p1GamepadAxisFlipped = false;
                        }
                    }

                    // Button 2 (X) to use item
                    if (gp1.buttons[2] && gp1.buttons[2].pressed && playerMode === 2) {
                        useItem(1);
                    }
                } else if (!isJumpscareActive && !isHugActive) {
                    const btnA = gp1.buttons[0] && gp1.buttons[0].pressed; 
                    const btnB = gp1.buttons[1] && gp1.buttons[1].pressed; 

                    if (menuState === "TITLE") {
                        if (btnA) showModeSelect();
                        else if (btnB) openShop();
                        else if (gp1.buttons[3] && gp1.buttons[3].pressed) openSettings(); 
                    } else if (menuState === "MODE_SELECT") {
                        if (btnA) selectMode(1);
                        else if (gp1.buttons[2] && gp1.buttons[2].pressed) selectMode(2);
                        else if (btnB) showTitleScreen();
                    } else if (menuState === "SHOP") {
                        if (btnB) showTitleScreen();
                    } else if (menuState === "SETTINGS") {
                        if (btnB) showTitleScreen();
                    } else if (menuState === "GAMEOVER") {
                        if (btnA) selectMode(playerMode);
                        else if (btnB) showTitleScreen();
                    }
                }
            }

            // Player 2 controls (uses Gamepad index 1)
            const gp2 = gamepads[1];
            if (gp2 && playerMode === 2 && gameActive) {
                const axisX = gp2.axes[0];
                const dpadLeft = gp2.buttons[14] && gp2.buttons[14].pressed;
                const dpadRight = gp2.buttons[15] && gp2.buttons[15].pressed;

                let moveLeft = (axisX < -0.5 || dpadLeft);
                let moveRight = (axisX > 0.5 || dpadRight);

                if (p2ReverseTimer > 0) {
                    const temp = moveLeft; moveLeft = moveRight; moveRight = temp;
                }

                if (p2FreezeTimer <= 0) {
                    if (moveLeft && !p2GamepadAxisFlipped && p2Lane > 0) {
                        p2Lane--; p2Mesh.position.x = laneXPositions[p2Lane]; p2GamepadAxisFlipped = true;
                    } else if (moveRight && !p2GamepadAxisFlipped && p2Lane < 2) {
                        p2Lane++; p2Mesh.position.x = laneXPositions[p2Lane]; p2GamepadAxisFlipped = true;
                    } else if (Math.abs(axisX) < 0.2 && !dpadLeft && !dpadRight) {
                        p2GamepadAxisFlipped = false;
                    }
                }

                // Button 2 (X) to use item
                if (gp2.buttons[2] && gp2.buttons[2].pressed) {
                    useItem(2);
                }
            }
        }

        function animate() {
            requestAnimationFrame(animate);
            pollGamepads();

            const dt = 0.016; // Standard fixed frame delta

            if (gameActive) {
                score++;
                if (playerMode === 1) updateUIScore();
                else update2pHUD();
                
                // Decrement active items timers
                if (p1InvincibilityTimer > 0) {
                    p1InvincibilityTimer -= dt;
                    if (p1InvincibilityTimer <= 0) p1ShieldVisual.visible = false;
                }
                if (p2InvincibilityTimer > 0) {
                    p2InvincibilityTimer -= dt;
                    if (p2InvincibilityTimer <= 0) p2ShieldVisual.visible = false;
                }
                if (p1FreezeTimer > 0) {
                    p1FreezeTimer -= dt;
                    if (p1FreezeTimer <= 0) p1FreezeVisual.visible = false;
                }
                if (p2FreezeTimer > 0) {
                    p2FreezeTimer -= dt;
                    if (p2FreezeTimer <= 0) p2FreezeVisual.visible = false;
                }
                if (p1ReverseTimer > 0) p1ReverseTimer -= dt;
                if (p2ReverseTimer > 0) p2ReverseTimer -= dt;
                if (p1SlowTimer > 0) p1SlowTimer -= dt;
                if (p2SlowTimer > 0) p2SlowTimer -= dt;
                if (coinRushTimer > 0) coinRushTimer -= dt;
                if (sabotageRushTimer > 0) sabotageRushTimer -= dt;

                // Logarithmic speed mapping
                currentSpeed = baseSpeed + Math.log(score * 0.005 + 1) * 0.12;

                spawnObstacle();

                for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obs = obstacles[i]; obs.mesh.position.z += currentSpeed;
                    if(obs.type === 'coin') obs.mesh.rotation.z += 0.05;
                    if(obs.type === 'item') {
                        obs.mesh.rotation.y += 0.03;
                        obs.mesh.rotation.x += 0.01;
                    }

                    // P1 Collision loop check
                    if (obs.lane === p1Lane) {
                        let hit = false;
                        if (obs.type === 'train') {
                            const halfLen = obs.mesh.userData.length / 2;
                            if (obs.mesh.position.z - halfLen < 0.6 && obs.mesh.position.z + halfLen > -0.6) {
                                hit = true;
                                if (p1InvincibilityTimer <= 0) {
                                    if (playerMode === 1) {
                                        triggerGameOver(false, 'train');
                                    } else {
                                        winnerNum = 2; // P2 wins
                                        triggerGameOver(false, 'p1_death');
                                    }
                                }
                            }
                        } else if (obs.type === 'coin') {
                            if (Math.abs(obs.mesh.position.z) < 0.8) {
                                sessionCoins += 1; scene.remove(obs.mesh); obstacles.splice(i, 1); continue;
                            }
                        } else if (obs.type === 'item' && playerMode === 2) {
                            if (Math.abs(obs.mesh.position.z) < 0.8) {
                                collectItem(1); scene.remove(obs.mesh); obstacles.splice(i, 1); continue;
                            }
                        } else if (obs.type === 'sphere') {
                            if (Math.abs(obs.mesh.position.z) < 0.8) {
                                hit = true;
                                if (p1InvincibilityTimer <= 0) {
                                    if (playerMode === 1) {
                                        if (jumpscaresEnabled) {
                                            triggerGameOver(true, 'jumpscare');
                                        } else {
                                            gameActive = false; menuState = "HUGGING"; isHugActive = true;
                                            hugSphere = obs.mesh; hugTimer = 0; playHugSound();
                                            obs.mesh.material.color.setHex(0xff55bb);
                                            obstacles.splice(i, 1);
                                            continue;
                                        }
                                    } else {
                                        winnerNum = 2;
                                        triggerGameOver(false, 'p1_death');
                                    }
                                }
                            }
                        }
                        if(hit && p1InvincibilityTimer <= 0) break;
                    }

                    // P2 Collision loop check (If actively in 2P Mode)
                    if (playerMode === 2 && obs.lane === p2Lane) {
                        let hit = false;
                        if (obs.type === 'train') {
                            const halfLen = obs.mesh.userData.length / 2;
                            if (obs.mesh.position.z - halfLen < -0.9 && obs.mesh.position.z + halfLen > -2.1) {
                                hit = true;
                                if (p2InvincibilityTimer <= 0) {
                                    winnerNum = 1; // P1 wins
                                    triggerGameOver(false, 'p2_death');
                                }
                            }
                        } else if (obs.type === 'coin') {
                            if (Math.abs(obs.mesh.position.z + 1.5) < 0.8) {
                                sessionCoins += 1; scene.remove(obs.mesh); obstacles.splice(i, 1); continue;
                            }
                        } else if (obs.type === 'item') {
                            if (Math.abs(obs.mesh.position.z + 1.5) < 0.8) {
                                collectItem(2); scene.remove(obs.mesh); obstacles.splice(i, 1); continue;
                            }
                        } else if (obs.type === 'sphere') {
                            if (Math.abs(obs.mesh.position.z + 1.5) < 0.8) {
                                hit = true;
                                if (p2InvincibilityTimer <= 0) {
                                    winnerNum = 1;
                                    triggerGameOver(false, 'p2_death');
                                }
                            }
                        }
                        if(hit && p2InvincibilityTimer <= 0) break;
                    }

                    if (obs.mesh.position.z > 10) { scene.remove(obs.mesh); obstacles.splice(i, 1); }
                }
            } else if (isHugActive) {
                // Squeeze sphere around player cube
                hugTimer += dt; 
                if (hugSphere) {
                    hugSphere.position.copy(p1Mesh.position);
                    const hugPulse = 1.3 + Math.sin(hugTimer * 12) * 0.15;
                    hugSphere.scale.set(hugPulse, hugPulse, hugPulse);
                }

                if (hugTimer >= 1.0) {
                    isHugActive = false;
                    if (hugSphere) { scene.remove(hugSphere); hugSphere = null; }
                    triggerGameOver(false, 'hug');
                }
            } else if (menuState === "COUNTDOWN") {
                p1Mesh.rotation.y = 0;
                p2Mesh.rotation.y = 0;
                runCountdown(dt);
            } else if (menuState === "GAMEOVER" && playerMode === 2) {
                // End screen animation
                const time = performance.now() * 0.001;
                updateTears(dt);

                if (winnerNum === 1) {
                    // P1 Wins - Jump up and down
                    p1Mesh.position.y = 0.6 + Math.abs(Math.sin(time * 10)) * 1.5;
                    
                    // P2 Loses - Nod Left and Right
                    p2Mesh.rotation.y = (Math.PI / 2) + ((Math.sin(time * 5)) * (Math.PI / 4));
                    p2Mesh.position.y = 0.6;
                    /*
                    // P2 Loses - Roll over and cry tears
                    p2Mesh.rotation.z = Math.PI / 2;
                    p2Mesh.position.y = 0.6;
                    if (Math.random() < 0.5) {
                        //spawnTear(p2Mesh.position.x, p2Mesh.position.y, p2Mesh.position.z);
                    }*/
                } else if (winnerNum === 2) {
                    // P2 Wins - Jump up and down
                    p2Mesh.position.y = 0.6 + Math.abs(Math.sin(time * 10)) * 1.5;
                    
                    // P1 Loses - Nod Left and Right
                    p1Mesh.rotation.y = (Math.PI / 2) + ((Math.sin(time * 5)) * (Math.PI / 4));
                    p1Mesh.position.y = 0.6;
                    /*
                    // P1 Loses - Roll over and cry tears
                    p1Mesh.rotation.z = Math.PI / 2;
                    p1Mesh.position.y = 0.6;
                    if (Math.random() < 0.5) {
                        //spawnTear(p1Mesh.position.x, p1Mesh.position.y, p1Mesh.position.z);
                    }*/
                }
            }
            renderer.render(scene, camera);
        }

        // HTML Menu Button Click Listeners
        document.getElementById('btn-start').addEventListener('click', showModeSelect);
        document.getElementById('btn-mode-1p').addEventListener('click', () => selectMode(1));
        document.getElementById('btn-mode-2p').addEventListener('click', () => selectMode(2));
        document.getElementById('btn-cancel-mode').addEventListener('click', showTitleScreen);
        document.getElementById('btn-shop').addEventListener('click', openShop);
        document.getElementById('btn-close-shop').addEventListener('click', showTitleScreen);
        document.getElementById('btn-restart').addEventListener('click', () => selectMode(playerMode));
        document.getElementById('btn-menu').addEventListener('click', showTitleScreen);
        
        // Settings Click Listeners
        document.getElementById('btn-settings-open').addEventListener('click', openSettings);
        document.getElementById('btn-v2-open').addEventListener('click', openV2Info);
        document.getElementById('btn-close-settings').addEventListener('click', showTitleScreen);
        document.getElementById('btn-jumpscare-toggle').addEventListener('click', toggleJumpscares);
        document.getElementById('btn-volume-toggle').addEventListener('click', toggleVolume);
        document.getElementById('btn-reset-data').addEventListener('click', confirmWipeData);
        document.getElementById('btn-close-v2').addEventListener('click', showTitleScreen);

        // Modal Event Listeners
        document.getElementById('btn-modal-yes').addEventListener('click', executeWipeData);
        document.getElementById('btn-modal-no').addEventListener('click', closeWipeModal);

        // Keyboard Routing Event Map
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (gameActive) {
                // Player 1 controls (A to move Left, D to move Right)
                let p1MoveLeft = (key === 'a');
                let p1MoveRight = (key === 'd');

                if (p1ReverseTimer > 0) {
                    const temp = p1MoveLeft; p1MoveLeft = p1MoveRight; p1MoveRight = temp;
                }

                if (p1FreezeTimer <= 0) {
                    if (p1MoveLeft && p1Lane > 0) { p1Lane--; p1Mesh.position.x = laneXPositions[p1Lane]; }
                    else if (p1MoveRight && p1Lane < 2) { p1Lane++; p1Mesh.position.x = laneXPositions[p1Lane]; }
                }

                // Player 1 use item (Q key)
                if (key === 'q' && playerMode === 2) {
                    useItem(1);
                }

                // Player 2 controls (J to move Left, L to move Right)
                if (playerMode === 2) {
                    let p2MoveLeft = (key === 'j');
                    let p2MoveRight = (key === 'l');

                    if (p2ReverseTimer > 0) {
                        const temp = p2MoveLeft; p2MoveLeft = p2MoveRight; p2MoveRight = temp;
                    }

                    if (p2FreezeTimer <= 0) {
                        if (p2MoveLeft && p2Lane > 0) { p2Lane--; p2Mesh.position.x = laneXPositions[p2Lane]; }
                        else if (p2MoveRight && p2Lane < 2) { p2Lane++; p2Mesh.position.x = laneXPositions[p2Lane]; }
                    }

                    // Player 2 use item (U key)
                    if (key === 'u') {
                        useItem(2);
                    }
                }
            } else if (!isJumpscareActive && !isHugActive) {
                if (menuState === "TITLE") {
                    if (e.key === ' ') showModeSelect();
                    else if (key === 's') openShop();
                    else if (key === 'o' || e.key === 'Escape') openSettings();
                } else if (menuState === "MODE_SELECT") {
                    if (key === '1') selectMode(1);
                    else if (key === '2') selectMode(2);
                    else if (e.key === 'Backspace') showTitleScreen();
                } else if (menuState === "SHOP") {
                    if (e.key === 'Backspace') showTitleScreen();
                } else if (menuState === "SETTINGS" || menuState === "V2-INFO") {
                    if (e.key === 'Backspace' || e.key === 'Escape') showTitleScreen();
                } else if (menuState === "GAMEOVER") {
                    if (key === 'y' || e.key === ' ') selectMode(playerMode);
                    else if (key === 'n') showTitleScreen();
                }
            }
        });

        // Controller Connection Alerts
        window.addEventListener("gamepadconnected", () => {
            const toast = document.getElementById('gamepad-toast');
            toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 3000);
        });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
        });

        init3D();
        animate();
    })();  