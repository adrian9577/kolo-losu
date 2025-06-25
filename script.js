const fileInput = document.getElementById('fileInput');
const spinButton = document.getElementById('spinButton');
const canvas = document.getElementById('luckyWheel');
const ctx = canvas.getContext('2d');
const resultDiv = document.getElementById('result');

let participants = [];
let normalizedParticipants = [];
let currentRotation = 0; // Całkowity obrót koła w stopniach (zawsze rosnący)
const spinDuration = 40000; // Czas trwania animacji w milisekundach (40 sekund)
let isSpinning = false;

// Funkcja do rysowania koła
function drawWheel() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (normalizedParticipants.length === 0) {
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('Wczytaj plik TXT z osobami, aby narysować koło.', canvas.width / 2, canvas.height / 2);
        return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.9;

    let startAngle = 0; 
    const colors = [
        '#FFD700', '#FF6347', '#6A5ACD', '#3CB371', '#BA55D3', 
        '#FF4500', '#ADFF2F', '#00BFFF', '#FF1493', '#8A2BE2',
        '#7FFF00', '#DC143C', '#00CED1', '#FF8C00', '#DA70D6'
    ];

    normalizedParticipants.forEach((participant, index) => {
        const sliceAngle = participant.percentage / 100 * (2 * Math.PI);
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        ctx.stroke();

        // Rysowanie tekstu
        const textAngle = startAngle + sliceAngle / 2;
        const textX = centerX + radius * 0.75 * Math.cos(textAngle);
        const textY = centerY + radius * 0.75 * Math.sin(textAngle);

        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(textAngle + (textAngle > Math.PI / 2 && textAngle < 3 * Math.PI / 2 ? Math.PI : 0)); // Obróć tekst, aby był czytelny
        ctx.fillStyle = '#000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(participant.name, 0, 0);
        ctx.restore();

        startAngle = endAngle;
    });
}

// Funkcja do normalizacji uczestników
function normalizeParticipants(participantsList) {
    if (!participantsList || participantsList.length === 0) {
        return [];
    }

    const totalEntries = participantsList.length;
    const uniqueParticipants = {};

    participantsList.forEach(name => {
        uniqueParticipants[name] = (uniqueParticipants[name] || 0) + 1;
    });

    return Object.keys(uniqueParticipants).map(name => {
        const count = uniqueParticipants[name];
        const percentage = (count / totalEntries) * 100;
        return { name, count, percentage };
    });
}

// Obsługa wczytywania pliku
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            participants = content.split('\n')
                                  .map(line => line.trim())
                                  .filter(line => line.length > 0);
            normalizedParticipants = normalizeParticipants(participants);
            drawWheel();
            spinButton.disabled = false;
        };
        reader.readAsText(file);
    } else {
        spinButton.disabled = true;
        participants = [];
        normalizedParticipants = [];
        drawWheel();
    }
});

// Funkcja tasowania (Fisher-Yates shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Obsługa przycisku "Zakręć kołem!"
spinButton.addEventListener('click', () => {
    if (isSpinning || normalizedParticipants.length === 0) {
        return;
    }

    isSpinning = true;
    spinButton.disabled = true;
    fileInput.disabled = true;
    resultDiv.textContent = 'Kręcę...';

    // Tasowanie uczestników przed losowaniem, aby wyniki były bardziej losowe
    shuffleArray(participants);
    normalizedParticipants = normalizeParticipants(participants);
    drawWheel(); // Narysuj koło ponownie z nową kolejnością, jeśli to ma wpływ na wizualizację

    const totalWeight = normalizedParticipants.reduce((sum, p) => sum + p.count, 0);
    let randomValue = Math.random() * totalWeight;
    let winner = null;

    for (let i = 0; i < normalizedParticipants.length; i++) {
        randomValue -= normalizedParticipants[i].count;
        if (randomValue <= 0) {
            winner = normalizedParticipants[i];
            break;
        }
    }

    if (!winner) {
        winner = normalizedParticipants[Math.floor(Math.random() * normalizedParticipants.length)];
    }

    // --- DIAGNOSTYKA ---
    console.log("Wylosowany zwycięzca:", winner.name);
    console.log("Całkowita liczba wpisów:", totalWeight);
    console.log("Wylosowana wartość randomValue (przed odjęciem):", randomValue + winner.count);
    // --- KONIEC DIAGNOSTYKI ---

    // Obliczanie kąta do zatrzymania koła
    // Potrzebujemy obrotu, który ustawi zwycięzcę pod wskaźnikiem.
    // Najpierw znajdź początkowy kąt segmentu zwycięzcy.
    let angleOfWinnerSegmentStart = 0;
    for (let i = 0; i < normalizedParticipants.length; i++) {
        if (normalizedParticipants[i].name === winner.name) {
            break; // Znaleziono początek segmentu zwycięzcy
        }
        angleOfWinnerSegmentStart += normalizedParticipants[i].percentage / 100 * (2 * Math.PI);
    }
    
    const sliceAngleWinner = winner.percentage / 100 * (2 * Math.PI);
    const angleOfWinnerSegmentMiddle = angleOfWinnerSegmentStart + sliceAngleWinner / 2;

    // Kąt, o który musimy obrócić koło, aby środek segmentu zwycięzcy znalazł się pod wskaźnikiem (0 stopni na górze)
    // Doliczamy wielokrotność 360 stopni, aby koło obracało się wiele razy
    const rotations = 5; // Minimalna liczba pełnych obrotów
    const degreesToSpinForWinner = (270 - (angleOfWinnerSegmentMiddle * 180 / Math.PI)) % 360;
    const targetRotation = currentRotation + rotations * 360 + degreesToSpinForWinner;

    // --- DIAGNOSTYKA ---
    console.log("currentRotation (start animacji):", currentRotation.toFixed(2), "stopni");
    console.log("degreesToSpinForWinner (do wskaźnika):", degreesToSpinForWinner.toFixed(2), "stopni");
    console.log("Całkowity obrót koła do celu:", targetRotation.toFixed(2), "stopni");
    // --- KONIEC DIAGNOSTYKI --
    
    const startTime = Date.now();
    let animationFrameId;

    function animate() {
        const elapsedTime = Date.now() - startTime;
        let progress = Math.min(elapsedTime / spinDuration, 1);

        const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

        const easedProgress = easeOutQuint(progress);

        currentRotation = (targetRotation * easedProgress);

        canvas.style.transform = `rotate(${currentRotation}deg)`;

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            currentRotation = targetRotation; 
            canvas.style.transform = `rotate(${currentRotation}deg)`;
            resultDiv.textContent = `Wylosowana osoba: ${winner.name}`; // Zmodyfikowana linia
            spinButton.disabled = false;
            fileInput.disabled = false;
            isSpinning = false;
            // --- DIAGNOSTYKA ---
            console.log("Zakończono animację. Wynik:", winner.name);
            // --- KONIEC DIAGNOSTYKI ---
        }
    }

    animationFrameId = requestAnimationFrame(animate);
});


// Funkcje do konfetti (przeniesione z poprzedniej rozmowy)
function createConfetti() {
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) {
        const newConfettiContainer = document.createElement('div');
        newConfettiContainer.id = 'confetti-container';
        document.body.appendChild(newConfettiContainer);
    }

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        confetti.style.animationDuration = Math.random() * 2 + 3 + 's'; // 3-5 seconds
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        
        // Ustawienie zmiennych CSS dla animacji fall
        confetti.style.setProperty('--x-end', `${(Math.random() - 0.5) * 200}px`);
        confetti.style.setProperty('--y-end', `${window.innerHeight + 100}px`);
        confetti.style.setProperty('--rotation-end', `${Math.random() * 720}deg`);

        document.getElementById('confetti-container').appendChild(confetti);

        confetti.addEventListener('animationend', () => {
            confetti.remove();
        });
    }
}

// Dodaj wywołanie konfetti po wylosowaniu zwycięzcy
// W funkcji animate, w bloku else (po zakończeniu animacji):
// createConfetti();
// Upewnij się, że masz element <div id="confetti-container"></div> w index.html
// oraz odpowiednie style CSS dla .confetti i @keyframes fall
