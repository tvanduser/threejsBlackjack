import * as THREE from 'three';

class BlackjackGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2c3e50); // Dark blue-gray background
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.cardGeometry = new THREE.BoxGeometry(1, 1.5, 0.01);
        this.playersTurn = true;
        this.scoreElement = document.getElementById('score');
        this.dealerScoreElement = document.getElementById('dealerScore');
        this.playAgainButton = document.getElementById('playAgain');
        this.playAgainButton.addEventListener('click', () => this.resetGame());
        this.textureLoader = new THREE.TextureLoader();
        this.cardTextures = {};
        this.cardBackTexture = null;
        this.messageElement = document.getElementById('gameMessage');
        
        // Initialize first, then load textures
        this.init();
        this.loadTextures().then(() => {
            this.dealInitialCards();
        });
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Update camera for more top-down view
        this.camera.position.z = 3;
        this.camera.position.y = 4;
        this.camera.rotation.x = -Math.PI / 3;

        // Better lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 10, 0);
        this.scene.add(directionalLight);

        const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
        frontLight.position.set(0, 2, 5);
        this.scene.add(frontLight);

        // Update table size and position
        const tableGeometry = new THREE.PlaneGeometry(8, 5);
        const tableMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x008000,
            roughness: 0.8,
            metalness: 0.2
        });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.rotation.x = -Math.PI / 2;
        table.position.y = -0.1;
        this.scene.add(table);

        // Setup event listeners
        document.getElementById('hitButton').addEventListener('click', () => this.hit());
        document.getElementById('standButton').addEventListener('click', () => this.stand());

        // Initialize deck
        this.initializeDeck();
        this.shuffle();

        // Start animation loop
        this.animate();
    }

    initializeDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        for (let suit of suits) {
            for (let value of values) {
                this.deck.push({ suit, value });
            }
        }
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    loadTextures() {
        return new Promise((resolve) => {
            const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
            const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
            
            // Start with fallback colored cards
            this.initializeDeck();
            this.shuffle();
            this.dealInitialCards();

            let loadedCount = 0;
            const totalTextures = (suits.length * values.length) + 1;

            // Error handler for texture loading
            const onError = (err) => {
                console.error('Error loading texture:', err);
                loadedCount++;
                if (loadedCount === totalTextures) {
                    resolve();
                }
            };

            // Load card back texture
            this.cardBackTexture = this.textureLoader.load(
                './textures/cards/back.png',
                checkAllLoaded,
                undefined,
                onError
            );

            // Load front textures
            suits.forEach(suit => {
                this.cardTextures[suit] = {};
                values.forEach(value => {
                    const texturePath = `./textures/cards/${value}_of_${suit}.png`;
                    this.cardTextures[suit][value] = this.textureLoader.load(
                        texturePath,
                        checkAllLoaded,
                        undefined,
                        onError
                    );
                });
            });

            function checkAllLoaded() {
                loadedCount++;
                if (loadedCount === totalTextures) {
                    resolve();
                }
            }
        });
    }

    createCardMesh(card, isHidden = false) {
        try {
            const frontTexture = this.cardTextures[card.suit][card.value];
            const backTexture = this.cardBackTexture;

            if (!frontTexture || !backTexture) {
                console.error('Missing texture for card:', card);
                return this.createFallbackCardMesh(card, isHidden);
            }

            const frontMaterial = new THREE.MeshStandardMaterial({ 
                map: frontTexture,
                side: THREE.DoubleSide,
                roughness: 0.4,
                metalness: 0.1
            });
            const backMaterial = new THREE.MeshStandardMaterial({ 
                map: backTexture,
                side: THREE.DoubleSide,
                roughness: 0.4,
                metalness: 0.1
            });

            const materials = Array(6).fill(backMaterial);
            materials[4] = isHidden ? backMaterial : frontMaterial;

            const cardMesh = new THREE.Mesh(this.cardGeometry, materials);
            cardMesh.rotation.x = -Math.PI / 2;
            return cardMesh;
        } catch (error) {
            console.error('Error creating card mesh:', error);
            return this.createFallbackCardMesh(card, isHidden);
        }
    }

    // Fallback to colored cards if textures fail
    createFallbackCardMesh(card, isHidden) {
        const frontMaterial = new THREE.MeshPhongMaterial({ 
            color: card.suit === 'hearts' || card.suit === 'diamonds' ? 0xff0000 : 0x000000 
        });
        const backMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff });
        const materials = Array(6).fill(backMaterial);
        materials[4] = isHidden ? backMaterial : frontMaterial;

        const cardMesh = new THREE.Mesh(this.cardGeometry, materials);
        cardMesh.rotation.x = -Math.PI / 2;
        return cardMesh;
    }

    dealCard(isPlayer, isHidden = false) {
        const card = this.deck.pop();
        const cardMesh = this.createCardMesh(card, isHidden);
        
        // Update card positions for flat layout
        if (isPlayer) {
            cardMesh.position.set(-1 + this.playerHand.length * 1.2, 0, 1.5);
            this.playerHand.push({ card, mesh: cardMesh });
        } else {
            cardMesh.position.set(-1 + this.dealerHand.length * 1.2, 0, -1.5);
            this.dealerHand.push({ card, mesh: cardMesh, isHidden });
        }
        
        this.scene.add(cardMesh);
        
        // Start animation from above
        cardMesh.position.y = 3;
        this.animateCard(cardMesh, cardMesh.position.x, 0, cardMesh.position.z);
        
        // Update score after dealing
        this.updateScore();
    }

    animateCard(cardMesh, targetX, targetY, targetZ) {
        // Add rotation animation
        let rotations = 0;
        const targetRotationX = -Math.PI / 2;
        cardMesh.rotation.x = 0;

        const animate = () => {
            // Move down
            cardMesh.position.y += (targetY - cardMesh.position.y) * 0.1;
            
            // Rotate card
            if (rotations < 1) {
                rotations += 0.1;
                cardMesh.rotation.x = targetRotationX * rotations;
            }
            
            if (Math.abs(cardMesh.position.y - targetY) > 0.01 || rotations < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    dealInitialCards() {
        this.dealCard(true); // Player's first card
        this.dealCard(false); // Dealer's first card
        this.dealCard(true); // Player's second card
        this.dealCard(false, true); // Dealer's second card (hidden)
    }

    calculateHandValue(hand) {
        let value = 0;
        let aces = 0;

        hand.forEach(({ card }) => {
            if (card.value === 'A') {
                aces += 1;
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                value += 10;
            } else {
                value += parseInt(card.value);
            }
        });

        // Add aces
        for (let i = 0; i < aces; i++) {
            if (value + 11 <= 21) {
                value += 11;
            } else {
                value += 1;
            }
        }

        return value;
    }

    updateScore() {
        const playerScore = this.calculateHandValue(this.playerHand);
        
        // Update player score
        this.scoreElement.textContent = `Your Cards: ${playerScore}`;
        
        // Update dealer score display
        if (this.playersTurn && this.dealerHand.length > 0) {
            const upCard = this.dealerHand[0].card;
            this.dealerScoreElement.textContent = `Dealer's Up Card: ${upCard.value}`;
        } else if (!this.playersTurn) {
            const dealerScore = this.calculateHandValue(this.dealerHand);
            this.dealerScoreElement.textContent = `Dealer's Cards: ${dealerScore}`;
        }
    }

    hit() {
        if (!this.playersTurn) return;
        
        this.dealCard(true);
        
        if (this.calculateHandValue(this.playerHand) > 21) {
            this.playersTurn = false;
            console.log('Bust!');
            this.endGame();
        }
    }

    stand() {
        if (!this.playersTurn) return;
        
        this.playersTurn = false;
        this.dealerPlay();
    }

    dealerPlay() {
        const hiddenCard = this.dealerHand[1];
        let flipRotation = 0;
        const originalY = hiddenCard.mesh.position.y;
        
        const flipAnimation = () => {
            if (flipRotation < 1) {
                flipRotation += 0.1;
                hiddenCard.mesh.position.y = originalY + Math.sin(flipRotation * Math.PI) * 0.5;
                hiddenCard.mesh.rotation.z = Math.PI * flipRotation;
                
                if (flipRotation >= 0.5 && hiddenCard.isHidden) {
                    hiddenCard.isHidden = false;
                    // Update with actual card texture
                    hiddenCard.mesh.material[4] = new THREE.MeshStandardMaterial({ 
                        map: this.cardTextures[hiddenCard.card.suit][hiddenCard.card.value],
                        side: THREE.DoubleSide
                    });
                    this.updateScore();
                }
                
                requestAnimationFrame(flipAnimation);
            } else {
                hiddenCard.mesh.position.y = originalY;
            }
        };
        flipAnimation();

        setTimeout(() => {
            while (this.calculateHandValue(this.dealerHand) < 17) {
                this.dealCard(false);
            }
            this.endGame();
        }, 1000);
    }

    showGameMessage(message) {
        this.messageElement.textContent = message;
        this.messageElement.style.display = 'block';
    }

    endGame() {
        const playerScore = this.calculateHandValue(this.playerHand);
        const dealerScore = this.calculateHandValue(this.dealerHand);

        let message;
        if (playerScore > 21) {
            message = 'Bust! You Lose!';
        } else if (dealerScore > 21) {
            message = 'Dealer Busts! You Win!';
        } else if (playerScore > dealerScore) {
            message = 'You Win!';
        } else if (playerScore < dealerScore) {
            message = 'Dealer Wins!';
        } else {
            message = 'Push - It\'s a Tie!';
        }

        this.showGameMessage(message);
        document.getElementById('hitButton').disabled = true;
        document.getElementById('standButton').disabled = true;
        this.playAgainButton.style.display = 'inline';
    }

    resetGame() {
        // Remove all cards from scene
        [...this.playerHand, ...this.dealerHand].forEach(({mesh}) => {
            this.scene.remove(mesh);
        });

        // Reset game state
        this.playerHand = [];
        this.dealerHand = [];
        this.playersTurn = true;
        this.deck = [];
        
        // Reset buttons
        document.getElementById('hitButton').disabled = false;
        document.getElementById('standButton').disabled = false;
        this.playAgainButton.style.display = 'none';

        // Reset dealer score
        this.dealerScoreElement.textContent = '';

        // Reset message
        this.messageElement.style.display = 'none';

        // Initialize new deck
        this.initializeDeck();
        this.shuffle();

        // Deal initial cards
        this.dealInitialCards();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
const game = new BlackjackGame();

// Handle window resize
window.addEventListener('resize', () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
}); 