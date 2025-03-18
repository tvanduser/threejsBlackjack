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
        this.balance = 1000;
        this.currentBet = 0;
        this.balanceElement = document.getElementById('balance');
        this.currentBetElement = document.getElementById('currentBet');
        this.splitHands = [];
        this.currentHand = 0; // Track which hand is being played when split
        
        // Add bet controls
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => this.addToBet(parseInt(chip.dataset.value)));
        });
        document.getElementById('clearBet').addEventListener('click', () => this.clearBet());
        document.getElementById('placeBet').addEventListener('click', () => this.startHand());
        
        // Add new button listeners
        document.getElementById('doubleButton').addEventListener('click', () => this.double());
        document.getElementById('splitButton').addEventListener('click', () => this.split());
        
        // Initialize first, then load textures
        this.init();
        this.loadTextures();
        this.createCardShoe();
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

            // Load card back texture with updated filename
            this.cardBackTexture = this.textureLoader.load(
                './textures/cards/back_of_card.png',  // Changed from back.png to back_of_card.png
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

    createCardShoe() {
        // Create shoe geometry with transparent material
        const shoeGeometry = new THREE.BoxGeometry(1.2, 0.8, 2);
        const shoeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x888888,
            transparent: true,
            opacity: 0.3,
            shininess: 100,
        });
        
        // Create the main shoe body
        this.shoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        this.shoe.position.set(-3, 0.4, -1);
        this.shoe.rotation.y = Math.PI / 6;
        
        // Create the card slot
        const slotGeometry = new THREE.BoxGeometry(1.1, 0.3, 0.1);
        const slotMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const slot = new THREE.Mesh(slotGeometry, slotMaterial);
        slot.position.set(0, 0.2, 1);
        this.shoe.add(slot);

        // Create decorative edges with more subtle appearance
        const edgeGeometry = new THREE.BoxGeometry(1.3, 0.1, 2.1);
        const edgeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x444444,
            transparent: true,
            opacity: 0.5
        });
        const topEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        topEdge.position.y = 0.45;
        this.shoe.add(topEdge);

        this.scene.add(this.shoe);

        // Create visible cards in the shoe
        this.createCardStack();
    }

    createCardStack() {
        // Remove old card stack if it exists
        if (this.cardStack) {
            this.scene.remove(this.cardStack);
        }

        // Create a group to hold all the card visuals
        this.cardStack = new THREE.Group();
        
        // Number of visible cards in the stack
        const numVisibleCards = Math.min(20, this.deck.length);
        const cardSpacing = 0.01; // Space between each card
        
        for (let i = 0; i < numVisibleCards; i++) {
            const cardGeometry = new THREE.PlaneGeometry(1, 1.5);
            const cardMaterial = new THREE.MeshStandardMaterial({
                map: this.cardBackTexture,
                side: THREE.DoubleSide
            });
            const card = new THREE.Mesh(cardGeometry, cardMaterial);
            
            // Position each card slightly offset from the previous
            card.position.set(0, 0.01 + (i * cardSpacing), 0);
            card.rotation.x = -Math.PI / 2;
            
            this.cardStack.add(card);
        }

        // Position the entire stack in the shoe
        this.cardStack.position.copy(this.shoe.position);
        this.cardStack.position.y += 0.41; // Adjust height to sit in shoe
        this.cardStack.rotation.y = this.shoe.rotation.y;
        
        this.scene.add(this.cardStack);
    }

    updateCardStack() {
        // Update the visibility of cards based on remaining deck size
        if (this.cardStack) {
            const visibleCards = this.cardStack.children;
            const numCardsToShow = Math.min(20, this.deck.length);
            
            for (let i = 0; i < visibleCards.length; i++) {
                visibleCards[i].visible = i < numCardsToShow;
            }
        }
    }

    dealCard(isPlayer, isHidden = false) {
        const card = this.deck.pop();
        const cardMesh = this.createCardMesh(card, isHidden);
        
        // Start position at the shoe's slot
        const shoePosition = new THREE.Vector3(-3, 0.5, -1);
        cardMesh.position.copy(shoePosition);
        cardMesh.position.z += 0.8; // Start at the shoe's slot
        cardMesh.rotation.copy(this.shoe.rotation);
        
        // Calculate target position
        const targetX = -1 + (isPlayer ? this.playerHand.length : this.dealerHand.length) * 1.2;
        const targetZ = isPlayer ? 1.5 : -1.5;
        
        if (isPlayer) {
            this.playerHand.push({ card, mesh: cardMesh });
        } else {
            this.dealerHand.push({ card, mesh: cardMesh, isHidden });
        }
        
        this.scene.add(cardMesh);
        this.animateCardFromShoe(cardMesh, targetX, 0, targetZ);
        this.updateScore();
        this.updateCardStack();
    }

    animateCardFromShoe(cardMesh, targetX, targetY, targetZ) {
        const startPos = cardMesh.position.clone();
        const startRot = cardMesh.rotation.clone();
        const targetRot = new THREE.Euler(-Math.PI / 2, 0, 0);
        let progress = 0;
        
        const animate = () => {
            progress += 0.02;
            
            // Smoother arc motion
            const height = Math.sin(progress * Math.PI) * 1.5;
            const slideOut = Math.min(1, progress * 2); // Initial sliding motion
            
            // First slide out, then arc to position
            cardMesh.position.x = startPos.x + (targetX - startPos.x) * progress;
            cardMesh.position.y = targetY + height;
            cardMesh.position.z = startPos.z + (targetZ - startPos.z) * progress;
            
            // Smoother rotation
            const rotationProgress = Math.min(1, progress * 1.5);
            cardMesh.rotation.x = startRot.x + (targetRot.x - startRot.x) * rotationProgress;
            cardMesh.rotation.y = startRot.y + (targetRot.y - startRot.y) * rotationProgress;
            cardMesh.rotation.z = startRot.z + (targetRot.z - startRot.z) * rotationProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    dealInitialCards() {
        setTimeout(() => {
            this.dealCard(true);  // First card to player
            setTimeout(() => {
                this.dealCard(false);  // First card to dealer
                setTimeout(() => {
                    this.dealCard(true);  // Second card to player
                    setTimeout(() => {
                        this.dealCard(false, true);  // Second card to dealer (face down)
                        setTimeout(() => {
                            this.updateControls(); // Update controls after all cards are dealt
                            this.checkForBlackjack();
                        }, 500);
                    }, 500);
                }, 500);
            }, 500);
        }, 0);
    }

    checkForBlackjack() {
        const playerScore = this.calculateHandValue(this.playerHand);
        const dealerUpCard = this.dealerHand[0].card;
        
        if (playerScore === 21) {
            // Player has blackjack, check if dealer also has blackjack
            const dealerScore = this.calculateHandValue(this.dealerHand);
            
            if (dealerScore === 21) {
                // Both have blackjack
                this.playersTurn = false;
                this.revealDealerCard();
                setTimeout(() => {
                    this.showGameMessage('Push - Both Have Blackjack!');
                    this.endGame();
                }, 1000);
            } else {
                // Only player has blackjack
                this.playersTurn = false;
                this.revealDealerCard();
                setTimeout(() => {
                    this.showGameMessage('Blackjack! You Win!');
                    this.endGame();
                }, 1000);
            }
        }
    }

    revealDealerCard() {
        const hiddenCard = this.dealerHand[1];
        let flipRotation = 0;
        const originalY = hiddenCard.mesh.position.y;
        
        const flipAnimation = () => {
            if (flipRotation < 1) {
                flipRotation += 0.1;
                
                // Lift card slightly during flip
                hiddenCard.mesh.position.y = originalY + Math.sin(flipRotation * Math.PI) * 0.2;
                
                // Keep card flat on table while rotating around Y axis
                hiddenCard.mesh.rotation.set(
                    -Math.PI / 2, // Keep flat on table
                    Math.PI * flipRotation, // Flip around Y axis
                    0 // No Z rotation
                );
                
                if (flipRotation >= 0.5 && hiddenCard.isHidden) {
                    hiddenCard.isHidden = false;
                    hiddenCard.mesh.material[4] = new THREE.MeshStandardMaterial({ 
                        map: this.cardTextures[hiddenCard.card.suit][hiddenCard.card.value],
                        side: THREE.DoubleSide
                    });
                    this.updateScore();
                }
                
                requestAnimationFrame(flipAnimation);
            } else {
                // Ensure final position and rotation are exact
                hiddenCard.mesh.position.y = originalY;
                hiddenCard.mesh.rotation.set(-Math.PI / 2, 0, 0);
            }
        };
        flipAnimation();
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
        if (this.splitHands.length > 0) {
            const hand1Score = this.calculateHandValue(this.splitHands[0]);
            const hand2Score = this.calculateHandValue(this.splitHands[1]);
            this.scoreElement.textContent = `Hand 1: ${hand1Score} | Hand 2: ${hand2Score}`;
        } else {
            const playerScore = this.calculateHandValue(this.playerHand);
            this.scoreElement.textContent = `Your Cards: ${playerScore}`;
        }
        
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

        if (this.splitHands.length > 0 && this.currentHand === 0) {
            // Move to second hand
            this.currentHand = 1;
            this.playerHand = this.splitHands[1];
            this.dealCard(true);
            this.updateScore();
            this.updateControls();
        } else {
            this.playersTurn = false;
            this.dealerPlay();
        }
    }

    dealerPlay() {
        this.revealDealerCard();

        const drawNextCard = () => {
            const dealerScore = this.calculateHandValue(this.dealerHand);
            if (dealerScore < 17) {
                this.dealCard(false);
                // Wait 1 second before drawing next card
                setTimeout(drawNextCard, 1000);
            } else {
                this.endGame();
            }
        };

        // Start drawing cards after the flip animation
        setTimeout(drawNextCard, 1000);
    }

    showGameMessage(message) {
        this.messageElement.textContent = message;
        this.messageElement.style.display = 'block';
    }

    endGame() {
        if (this.splitHands.length > 0) {
            this.endSplitGame();
        } else {
            const playerScore = this.calculateHandValue(this.playerHand);
            const dealerScore = this.calculateHandValue(this.dealerHand);

            let message;
            let multiplier = 0;

            if (playerScore === 21 && this.playerHand.length === 2) {
                // Blackjack pays 3:2
                message = 'Blackjack! You Win!';
                multiplier = 2.5;
            } else if (playerScore > 21) {
                message = 'Bust! You Lose!';
                multiplier = 0;
            } else if (dealerScore > 21) {
                message = 'Dealer Busts! You Win!';
                multiplier = 2;
            } else if (playerScore > dealerScore) {
                message = 'You Win!';
                multiplier = 2;
            } else if (playerScore < dealerScore) {
                message = 'Dealer Wins!';
                multiplier = 0;
            } else {
                message = 'Push - It\'s a Tie!';
                multiplier = 1;
            }

            // Update balance based on game outcome
            this.balance += this.currentBet * multiplier;
            this.currentBet = 0;
            this.updateBetDisplay();

            this.showGameMessage(message);
            document.getElementById('hitButton').disabled = true;
            document.getElementById('standButton').disabled = true;
            this.playAgainButton.style.display = 'inline';
        }
    }

    endSplitGame() {
        const dealerScore = this.calculateHandValue(this.dealerHand);
        const hand1Score = this.calculateHandValue(this.splitHands[0]);
        const hand2Score = this.calculateHandValue(this.splitHands[1]);
        
        let message = '';
        let totalMultiplier = 0;

        // Calculate result for hand 1
        if (hand1Score > 21) {
            message += 'Hand 1: Bust! ';
        } else if (dealerScore > 21 || hand1Score > dealerScore) {
            message += 'Hand 1: Win! ';
            totalMultiplier += 2;
        } else if (hand1Score < dealerScore) {
            message += 'Hand 1: Lose! ';
        } else {
            message += 'Hand 1: Push! ';
            totalMultiplier += 1;
        }

        // Calculate result for hand 2
        if (hand2Score > 21) {
            message += 'Hand 2: Bust!';
        } else if (dealerScore > 21 || hand2Score > dealerScore) {
            message += 'Hand 2: Win!';
            totalMultiplier += 2;
        } else if (hand2Score < dealerScore) {
            message += 'Hand 2: Lose!';
        } else {
            message += 'Hand 2: Push!';
            totalMultiplier += 1;
        }

        // Update balance (each hand bet separately)
        this.balance += (this.currentBet / 2) * totalMultiplier;
        this.currentBet = 0;
        this.updateBetDisplay();

        this.showGameMessage(message);
        this.disableAllButtons();
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
        document.getElementById('hitButton').disabled = true;
        document.getElementById('standButton').disabled = true;
        this.playAgainButton.style.display = 'none';

        // Reset dealer score
        this.dealerScoreElement.textContent = '';

        // Reset message
        this.messageElement.style.display = 'none';

        // Reset betting controls
        document.getElementById('placeBet').disabled = false;
        document.querySelectorAll('.chip').forEach(chip => chip.disabled = false);
        document.getElementById('clearBet').disabled = false;

        // Reset split hands
        this.splitHands = [];
        this.currentHand = 0;

        // Initialize new deck
        this.initializeDeck();
        this.shuffle();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    addToBet(amount) {
        if (this.balance >= amount) {
            this.currentBet += amount;
            this.balance -= amount;
            this.updateBetDisplay();
        }
    }

    clearBet() {
        this.balance += this.currentBet;
        this.currentBet = 0;
        this.updateBetDisplay();
    }

    updateBetDisplay() {
        this.balanceElement.textContent = `Balance: $${this.balance}`;
        this.currentBetElement.textContent = `Current Bet: $${this.currentBet}`;
    }

    startHand() {
        if (this.currentBet > 0) {
            // Disable betting controls
            document.getElementById('placeBet').disabled = true;
            document.querySelectorAll('.chip').forEach(chip => chip.disabled = true);
            document.getElementById('clearBet').disabled = true;
            
            // Deal initial cards
            this.dealInitialCards();
            
            // Enable game buttons
            document.getElementById('hitButton').disabled = false;
            document.getElementById('standButton').disabled = false;
            document.getElementById('doubleButton').disabled = false; // Enable double button
            
            // Update controls for split option
            this.updateControls();
        }
    }

    updateControls() {
        const hitButton = document.getElementById('hitButton');
        const standButton = document.getElementById('standButton');
        const doubleButton = document.getElementById('doubleButton');
        const splitButton = document.getElementById('splitButton');

        if (this.playersTurn) {
            hitButton.disabled = false;
            standButton.disabled = false;

            // Enable double if:
            // - Have enough money
            // - First decision (2 cards only)
            const canDouble = this.balance >= this.currentBet && 
                            this.playerHand.length === 2;
            doubleButton.disabled = !canDouble;

            // Enable split if:
            // - Have enough money
            // - Have exactly 2 cards
            // - Cards are same rank
            // - Not already split
            const card1Rank = this.getCardRank(this.playerHand[0].card);
            const card2Rank = this.getCardRank(this.playerHand[1].card);
            const canSplit = this.playerHand.length === 2 && 
                           this.balance >= this.currentBet &&
                           card1Rank === card2Rank &&
                           this.splitHands.length === 0;
            
            splitButton.disabled = !canSplit;
        } else {
            hitButton.disabled = true;
            standButton.disabled = true;
            doubleButton.disabled = true;
            splitButton.disabled = true;
        }
    }

    // Fix the getCardRank method to properly handle face cards
    getCardRank(card) {
        if (['10', 'J', 'Q', 'K'].includes(card.value)) return '10';
        return card.value;
    }

    split() {
        if (this.balance < this.currentBet) return;

        // Create two new hands from the pair
        const card1 = this.playerHand[0];
        const card2 = this.playerHand[1];
        
        // Remove original cards from scene
        this.scene.remove(card1.mesh);
        this.scene.remove(card2.mesh);

        // Create split hands
        this.splitHands = [
            [card1],
            [card2]
        ];

        // Deduct additional bet
        this.balance -= this.currentBet;
        this.updateBetDisplay();

        // Set current hand to first split hand
        this.playerHand = this.splitHands[0];
        this.currentHand = 0;

        // Position cards for split hands
        card1.mesh.position.x = -2;  // Left hand
        this.scene.add(card1.mesh);

        card2.mesh.position.x = 2;   // Right hand
        this.scene.add(card2.mesh);

        // Deal one new card to the first hand
        this.dealCard(true);
        
        this.updateScore();
        this.updateControls();
    }

    disableAllButtons() {
        document.getElementById('hitButton').disabled = true;
        document.getElementById('standButton').disabled = true;
        document.getElementById('doubleButton').disabled = true;
        document.getElementById('splitButton').disabled = true;
    }

    // Add this method back
    double() {
        if (this.balance < this.currentBet) return;
        
        // Double the bet
        this.balance -= this.currentBet;
        this.currentBet *= 2;
        this.updateBetDisplay();

        // Deal one card and stand
        this.dealCard(true);
        this.playersTurn = false;
        this.dealerPlay();
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