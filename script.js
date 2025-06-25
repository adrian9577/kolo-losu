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
        '#FFD700', '#FF6347', '#6A5ACD', '#3CB371', '#FFA07A', '#BA55D3', '#4682B4', '#DAA520', '#A52A2A', '#DDA0DD',
        '#FF69B4', '#8A2BE2', '#7FFF00', '#D2691E', '#FF00FF', '#00FFFF', '#ADFF2F', '#F08080', '#20B2AA', '#87CEEB',
        '#FF4500', '#DEB887', '#5F9EA0', '#7FFF00', '#DC143C', '#00BFFF', '#9932CC', '#E9967A', '#8FBC8F', '#48D1CC',
        '#B0C4DE', '#FFE4B5', '#8B0000', '#008B8B', '#B8860B', '#A9A9A9', '#006400', '#BDB76B', '#8B008B', '#556B2F'
    ]; 

    function getTextColor(bgColor) {
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return (brightness > 180) ? '#000000' : '#FFFFFF'; 
    }

    normalizedParticipants.forEach((participant, index) => {
        const sliceAngle = participant.normalizedPercentage * 2 * Math.PI; 
        const currentSegmentColor = colors[index % colors.length];

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();

        ctx.fillStyle = currentSegmentColor;
        ctx.fill();
        ctx.stroke();

        const textAngle = startAngle + sliceAngle / 2; 
        const textRadius = radius * 0.7; // Tekst bliżej środka, aby nie wychodził poza krawędź
        const textX = centerX + Math.cos(textAngle) * textRadius;
        const textY = centerY + Math.sin(textAngle) * textRadius;

        ctx.save();
        ctx.translate(textX, textY);
        
        // Uproszczona logika obrotu tekstu:
        // Kąt w stopniach (od 0 do 360). 0 to góra.
        // Jeśli tekst jest w lewej połowie koła (od 90 do 270 stopni), obróć go o 180 stopni,
        // aby był zawsze czytelny z dołu/prawej strony.
        let rotationForText = textAngle;
        if (textAngle > Math.PI / 2 && textAngle < Math.PI * 1.5) {
            rotationForText += Math.PI; // Obróć o 180 stopni
        }
        ctx.rotate(rotationForText);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = getTextColor(currentSegmentColor); 
        
        // Nowa, bardziej płynna logika rozmiaru czcionki
        let baseFontSize = 24; // Maksymalny rozmiar czcionki
        const minFontSize = 8; // Minimalny rozmiar czcionki

        // Obliczamy skalę czcionki na podstawie liczby uczestników
        let fontSize = baseFontSize;
        if (normalizedParticipants.length > 20) {
            fontSize = Math.max(minFontSize, baseFontSize - (normalizedParticipants.length - 20) * 0.05); // Delikatna redukcja
        }

        // Dodatkowe zmniejszenie dla bardzo małych segmentów
        const angleInDegrees = sliceAngle * 180 / Math.PI;
        const minAngleForFullSizeText = 15; // Kąt, poniżej którego zaczynamy zmniejszać czcionkę
        if (angleInDegrees < minAngleForFullSizeText) {
            fontSize = Math.max(minFontSize, fontSize * (angleInDegrees / minAngleForFullSizeText));
        }

        fontSize = Math.floor(fontSize); // Upewniamy się, że rozmiar czcionki to liczba całkowita
        ctx.font = `bold ${fontSize}px Arial`;

        const maxTextWidth = radius * 0.5; // Maksymalna szerokość tekstu w segmencie
        const words = participant.name.split(' ');
        let line = '';
        let lineHeight = fontSize + 2;
        let yOffset = -(words.length > 1 ? (words.length - 1) * lineHeight / 2 : 0);

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxTextWidth && n > 0) {
                ctx.fillText(line.trim(), 0, yOffset);
                line = words[n] + ' ';
                yOffset += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line.trim(), 0, yOffset);

        ctx.restore();

        startAngle += sliceAngle;
    });
}

// Obsługa wczytywania pliku
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            
            // Dodajemy unikalne ID do każdego uczestnika
            participants = lines.map((line, idx) => {
                const parts = line.split(','); 
                if (parts.length === 2) {
                    const name = parts[0].trim();
                    const percentage = parseFloat(parts[1].trim());
                    if (!isNaN(percentage) && percentage >= 0) { 
                        return { id: idx, name, percentage }; // Dodajemy id
                    }
                }
                return null;
            }).filter(p => p !== null);

            if (participants.length > 0) {
                const totalWeight = participants.reduce((sum, p) => sum + p.percentage, 0);

                if (totalWeight === 0) {
                    alert('Suma procentów (wag) wynosi 0. Nie można wylosować osoby. Proszę popraw plik.');
                    spinButton.disabled = true;
                    normalizedParticipants = [];
                } else {
                    normalizedParticipants = participants.map(p => ({
                        ...p,
                        normalizedPercentage: p.percentage / totalWeight
                    }));
                    spinButton.disabled = false;
                }
            } else {
                spinButton.disabled = true;
                normalizedParticipants = [];
                alert('Brak poprawnych danych w pliku TXT. Upewnij się, że format to "Nazwa,Procent".');
            }
            drawWheel();
            resultDiv.textContent = '';
        };
        reader.readAsText(file);
    } else {
        participants = [];
        normalizedParticipants = [];
        spinButton.disabled = true;
        drawWheel();
        resultDiv.textContent = '';
    }
});

// Funkcja losująca zwycięzcę
function getRandomWinner() {
    const randomNumber = Math.random(); 
    let cumulativeNormalizedPercentage = 0;
    for (const participant of normalizedParticipants) {
        cumulativeNormalizedPercentage += participant.normalizedPercentage;
        if (randomNumber <= cumulativeNormalizedPercentage) {
            return participant; // Zwracamy obiekt uczestnika z jego ID
        }
    }
    // Awaryjnie, jeśli nic nie zostało wylosowane (powinno się zdarzyć bardzo rzadko)
    return normalizedParticipants[normalizedParticipants.length - 1];
}

// Funkcja do obliczania kąta (w stopniach) dla środka segmentu zwycięzcy
function getAngleForWinner(winnerId) {
    let angleSum = 0; // Suma kątów poprzednich segmentów w RADIANACH
    let currentAngleDegrees = 0; // Kąt zwycięzcy w stopniach

    for (const participant of normalizedParticipants) {
        const sliceAngleRadians = participant.normalizedPercentage * 2 * Math.PI; // Kąt bieżącego segmentu w radianach
        if (participant.id === winnerId) {
            // Środek tego segmentu w radianach (liczony od 0 na prawo, rosnąco zgodnie z ruchem wskazówek zegara)
            const centerOfWinnerSegmentRadians = angleSum + (sliceAngleRadians / 2);
            // Kąt w Canvas to 0 prawo, 90 dół, 180 lewo, 270 góra.
            // My chcemy, żeby strzałka (na górze) wskazywała na środek segmentu.
            // Pozycja "góra" w systemie Canvas to 270 stopni (lub -90 stopni).
            // Potrzebujemy obrotu, który przeniesie centerOfWinnerSegmentRadians do pozycji 270 stopni.
            // Obrót = (270 - obecny kąt)
            let angleToRotateToTop = (270 - (centerOfWinnerSegmentRadians * 180 / Math.PI)) % 360;
            if (angleToRotateToTop < 0) angleToRotateToTop += 360; // Upewniamy się, że jest pozytywny
            return angleToRotateToTop;
        }
        angleSum += sliceAngleRadians;
    }
    return 0; // Awaryjnie
}


// Funkcja animacji kręcenia
function spinWheel() {
    if (isSpinning) return; 
    isSpinning = true;

    spinButton.disabled = true;
    fileInput.disabled = true;

    resultDiv.textContent = 'Kręcenie kołem...';

    const winner = getRandomWinner();
    // degreesToSpinForWinner to kąt, o który koło musi się obrócić,
    // aby środek segmentu zwycięzcy był na górze (pod strzałką).
    const degreesToSpinForWinner = getAngleForWinner(winner.id); 

    // currentRotation to całkowity, narastający obrót w stopniach.
    // Konwertujemy go na kąt w zakresie 0-360, który jest "widoczny" dla użytkownika.
    let currentVisualAngle = currentRotation % 360;
    if (currentVisualAngle < 0) currentVisualAngle += 360; 

    // Obliczamy różnicę między obecnym widocznym kątem a docelowym kątem.
    // Jest to "reszta" obrotu, którą musimy wykonać w bieżącym obrocie 360 stopni.
    // Dążymy do tego, aby degreesToSpinForWinner był nowym "currentVisualAngle" po animacji.
    let remainingSpinForTarget = (degreesToSpinForWinner - currentVisualAngle + 360) % 360;

    // Dodajemy losową liczbę pełnych obrotów, aby koło kręciło się dłużej i nie zatrzymało się od razu.
    const minimumFullRotations = 5; // Minimalnie 5 pełnych obrotów
    const additionalRandomRotations = Math.floor(Math.random() * 10); // Dodatkowo do 10 losowych pełnych obrotów (czyli łącznie 5 do 14 pełnych obrotów)
    
    const fullRotationsInDegrees = (minimumFullRotations + additionalRandomRotations) * 360;
    
    // Finalny kąt obrotu
    // currentRotation (całkowity dotychczasowy obrót) + pełne obroty + reszta do celu
    let targetRotation = currentRotation + fullRotationsInDegrees + remainingSpinForTarget;
    
    // Losowy, niewielki offset dla bardziej naturalnego zatrzymania (nie idealnie w środku, ale blisko)
    targetRotation += (Math.random() * 2) - 1; // +/- 1 stopień (minimalne przesunięcie)

    const startTime = Date.now();
    let animationFrameId;

    function animate() {
        const elapsedTime = Date.now() - startTime;
        let progress = Math.min(elapsedTime / spinDuration, 1);

        // Funkcja ułatwiająca animację (ease-out): zaczyna szybko, kończy wolno
        const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

        const easedProgress = easeOutQuint(progress);

        currentRotation = (targetRotation * easedProgress);

        canvas.style.transform = `rotate(${currentRotation}deg)`;

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            currentRotation = targetRotation; // Ustaw ostateczny kąt po zakończeniu animacji
            canvas.style.transform = `rotate(${currentRotation}deg)`;
            resultDiv.textContent = `Wylosowana osoba: ${winner.name} (oryginalny procent: ${winner.percentage}%)`;
            spinButton.disabled = false;
            fileInput.disabled = false;
            isSpinning = false;
        }
    }

    animationFrameId = requestAnimationFrame(animate);
}

// Obsługa kliknięcia przycisku "Zakręć kołem!"
spinButton.addEventListener('click', spinWheel);

// Początkowe rysowanie koła przy ładowaniu strony
drawWheel();