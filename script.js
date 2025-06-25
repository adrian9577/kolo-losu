const fileInput = document.getElementById('fileInput');
const spinButton = document.getElementById('spinButton');
const canvas = document.getElementById('luckyWheel');
const ctx = canvas.getContext('2d');
const resultDiv = document.getElementById('result');
const confettiContainer = document.getElementById('confetti-container'); // NOWY ELEMENT

let normalizedParticipants = []; // Będzie przechowywać WSZYSTKIE wpisy z pliku, każdy jako osobny segment
let uniqueParticipantCounts = new Map(); // Nowa mapa do przechowywania unikalnych nazw i ich liczby wystąpień
let currentRotation = 0; // Całkowity obrót koła w stopniach (zawsze rosnący)
const spinDuration = 7000; // Czas trwania animacji na 7 sekund (7000 milisekund)
let isSpinning = false;
const EPSILON = 0.01; // Mała tolerancja dla porównań liczb zmiennoprzecinkowych

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
        '#FFA07A', '#20B2AA', '#7B68EE', '#BDB76B', '#ADFF2F',
        '#FF4500', '#DA70D6', '#87CEEB', '#CD5C5C', '#F08080',
        '#4682B4', '#D2B48C', '#8A2BE2', '#F4A460', '#9ACD32',
        '#FFC0CB', '#808000', '#00FFFF', '#800080', '#0000FF',
        '#FFFF00', '#00FF00', '#FF00FF', '#008080', '#800000',
        '#FF0000', '#00FF7F', '#FF8C00', '#4B0082', '#ADFF2F',
        '#8B0000', '#008080', '#800080', '#00CED1', '#F0E68C',
        '#9ACD32', '#6A5ACD', '#CD5C5C', '#8B008B', '#00CED1'
    ]; // Więcej kolorów dla większej liczby uczestników

    // Funkcja do wyboru koloru tekstu na podstawie koloru tła (dla kontrastu)
    function getTextColor(bgColor) {
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        // Oblicz jasność Y = (R*299 + G*587 + B*114) / 1000
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return (brightness > 180) ? '#000000' : '#FFFFFF'; // Ciemny tekst na jasnym tle, jasny na ciemnym
    }

    normalizedParticipants.forEach((participant, index) => {
        // Wszystkie segmenty mają teraz tę samą procentową wielkość,
        // ponieważ każdy wpis z pliku to osobny segment.
        const sliceAngle = participant.normalizedPercentage * 2 * Math.PI; // Kąt wycinka w radianach
        const endAngle = startAngle + sliceAngle;
        const currentSegmentColor = colors[index % colors.length];

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = currentSegmentColor;
        ctx.fill();
        ctx.stroke(); // Rysuj obramowanie

        // Rysowanie tekstu (nazwy uczestnika)
        const textRadius = radius * 0.7; // Tekst bliżej środka, aby nie wychodził poza krawędź
        const textAngle = startAngle + sliceAngle / 2; // Środek kąta segmentu
        const textX = centerX + Math.cos(textAngle) * textRadius;
        const textY = centerY + Math.sin(textAngle) * textRadius;

        ctx.save(); // Zapisz aktualny stan canvasu
        ctx.translate(textX, textY); // Przesuń punkt początkowy do pozycji tekstu

        // Obróć tekst tak, aby był prostopadle do promienia i zawsze czytelny
        let rotationForText = textAngle;
        if (textAngle > Math.PI / 2 && textAngle < Math.PI * 1.5) {
            rotationForText += Math.PI; // Obróć o 180 stopni, aby tekst nie był do góry nogami
        }
        ctx.rotate(rotationForText);

        ctx.textAlign = 'center'; // Wyśrodkuj tekst
        ctx.textBaseline = 'middle'; // Ustaw linię bazową tekstu na środek
        ctx.fillStyle = getTextColor(currentSegmentColor); // Ustaw kolor tekstu dynamicznie

        // Dynamiczne dostosowanie rozmiaru czcionki
        let baseFontSize = 20; // Bazowy rozmiar czcionki
        const minFontSize = 8; // Minimalny rozmiar czcionki
        const maxTextWidth = radius * 0.5; // Maksymalna szerokość tekstu w segmencie

        let fontSize = baseFontSize;

        // Jeśli jest dużo uczestników, zmniejsz globalnie rozmiar czcionki
        if (normalizedParticipants.length > 50) {
            fontSize = Math.max(minFontSize, baseFontSize - (normalizedParticipants.length - 50) * 0.1);
        }

        // Dodatkowe zmniejszenie dla bardzo małych segmentów (mały kąt)
        const angleInDegrees = sliceAngle * 180 / Math.PI;
        const minAngleForFullSizeText = 15; // Kąt, poniżej którego zaczynamy zmniejszać czcionkę
        if (angleInDegrees < minAngleForFullSizeText && angleInDegrees > 0) { // Upewnij się, że kąt jest dodatni
            fontSize = Math.max(minFontSize, fontSize * (angleInDegrees / minAngleForFullSizeText));
        }

        fontSize = Math.floor(fontSize); // Upewniamy się, że rozmiar czcionki to liczba całkowita
        ctx.font = `bold ${fontSize}px Arial`;

        // Dzielenie tekstu na wiele linii, jeśli jest za długi
        const words = participant.name.split(' ');
        let line = '';
        let lineHeight = fontSize + 2;
        let yOffset = -(words.length > 1 ? (words.length - 1) * lineHeight / 2 : 0); // Wyśrodkuj pionowo

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

        ctx.restore(); // Przywróć poprzedni stan canvasu

        startAngle = endAngle; // Aktualizuj kąt początkowy dla następnego wycinka
    });
}

// Funkcja do obliczania kąta (w stopniach) dla środka segmentu zwycięzcy
function getAngleForWinner(winnerId) {
    let angleSum = 0; // Suma kątów poprzednich segmentów w RADIANACH

    for (const participant of normalizedParticipants) {
        const sliceAngleRadians = participant.normalizedPercentage * 2 * Math.PI;
        if (participant.id === winnerId) {
            const centerOfWinnerSegmentRadians = angleSum + (sliceAngleRadians / 2);
            // Przeliczamy kąt na stopnie i dostosowujemy do pozycji strzałki (góra, czyli 270 stopni w układzie canvas)
            // Kąt w Canvas: 0 (prawo), 90 (dół), 180 (lewo), 270 (góra).
            // Chcemy, żeby środek segmentu znalazł się na pozycji 270 stopni (góra).
            let angleToRotateToTop = (270 - (centerOfWinnerSegmentRadians * 180 / Math.PI));
            angleToRotateToTop = (angleToRotateToTop % 360 + 360) % 360; // Zapewnij kąt dodatni od 0 do 360
            return angleToRotateToTop;
        }
        angleSum += sliceAngleRadians;
    }
    return 0; // Awaryjnie
}

// NOWA FUNKCJA: Generowanie konfetti
function generateConfetti() {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#9e9e9e', '#607d8b'];
    const numConfetti = 100; // Liczba cząsteczek konfetti

    for (let i = 0; i < numConfetti; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');

        // Losowy kolor
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        // Losowa pozycja startowa (szerokość ekranu)
        const startX = Math.random() * window.innerWidth;
        confetti.style.left = `${startX}px`;
        confetti.style.top = `-20px`; // Zaczyna nad ekranem

        // Losowe wartości dla animacji CSS
        const endX = startX + (Math.random() - 0.5) * 500; // +- 250px od startu
        const endY = window.innerHeight + 20; // Spada poza ekran
        const rotationEnd = Math.random() * 720 + 360; // Losowy obrót

        confetti.style.setProperty('--x-end', `${endX}px`);
        confetti.style.setProperty('--y-end', `${endY}px`);
        confetti.style.setProperty('--rotation-end', `${rotationEnd}deg`);

        // Losowy czas trwania animacji i opóźnienie
        const animationDuration = Math.random() * 3 + 2; // 2 do 5 sekund
        const animationDelay = Math.random() * 0.5; // 0 do 0.5 sekundy

        confetti.style.animation = `fall ${animationDuration}s ${animationDelay}s forwards`;

        confettiContainer.appendChild(confetti);

        // Usuń konfetti po zakończeniu animacji
        confetti.addEventListener('animationend', () => {
            confetti.remove();
        });
    }
}


// Funkcja animacji kręcenia
function spinWheel() {
    if (isSpinning || normalizedParticipants.length === 0) {
        return;
    }

    isSpinning = true;
    spinButton.disabled = true;
    fileInput.disabled = true;
    resultDiv.textContent = 'Kręcenie kołem...';
    confettiContainer.innerHTML = ''; // Wyczyść stare konfetti

    // Wybierz losowy indeks zwycięzcy z normalizedParticipants.
    // Każdy segment ma równą szansę, ponieważ są to pojedyncze wpisy.
    const winnerIndex = Math.floor(Math.random() * normalizedParticipants.length);
    const winnerSegment = normalizedParticipants[winnerIndex];

    const degreesToSpinForWinner = getAngleForWinner(winnerSegment.id);

    const fullSpins = 5; // Minimalna liczba pełnych obrotów dla animacji.

    // Obliczanie rotacji potrzebnej do wyrównania segmentu zwycięzcy z wskaźnikiem (który jest na 0 stopni - góra).
    // Jeśli środek segmentu to `degreesToSpinForWinner`, to koło musi obrócić się o `(360 - degreesToSpinForWinner)`
    // stopni, aby ten środek znalazł się pod strzałką.
    const targetAlignmentDegrees = (360 - degreesToSpinForWinner) % 360;

    // Aktualna wizualna orientacja koła (w zakresie 0-360 stopni)
    let currentVisualRotation = currentRotation % 360;
    if (currentVisualRotation < 0) currentVisualRotation += 360; // Normalizacja, jeśli byłby ujemny

    // Oblicz, ile dodatkowych stopni musimy obrócić od obecnej pozycji do pozycji docelowej
    let spinAdjustment = (targetAlignmentDegrees - currentVisualRotation + 360) % 360;

    // Jeśli koło jest już bardzo blisko lub dokładnie na pozycji docelowej,
    // ale chcemy, żeby się zakręciło, dodaj pełen obrót.
    if (Math.abs(spinAdjustment) < EPSILON && Math.abs((currentVisualRotation - targetAlignmentDegrees + 360) % 360) < EPSILON) {
        spinAdjustment = 360; // Wymuś pełen obrót, jeśli jest już na celu
    }

    const initialWheelRotation = currentRotation; // Zapamiętaj początkowy obrót koła przed rozpoczęciem nowej animacji
    // Całkowity obrót docelowy (absolutny) = początkowy obrót + pełne obroty + korekcja do celu
    const finalRotationAbsolute = initialWheelRotation + (fullSpins * 360) + spinAdjustment;

    // --- DIAGNOSTYKA ---
    console.log("Wylosowany segment:", winnerSegment.name, "| Id:", winnerSegment.id);
    console.log("Kąt środka segmentu zwycięzcy (na kole):", degreesToSpinForWinner.toFixed(2), "stopni");
    console.log("Kąt, który ma być pod strzałką (celowe wyrównanie):", targetAlignmentDegrees.toFixed(2), "stopni");
    console.log("Aktualna wizualna orientacja koła (0-359):", currentVisualRotation.toFixed(2), "stopni");
    console.log("Dodatkowy obrót od obecnej pozycji do celu (0-359):", spinAdjustment.toFixed(2), "stopni");
    console.log("Początkowy absolutny obrót koła (przed spinem):", initialWheelRotation.toFixed(2), "stopni");
    console.log("Końcowy absolutny obrót koła (po animacji):", finalRotationAbsolute.toFixed(2), "stopni");
    // --- KONIEC DIAGNOSTYKI ---

    const startTime = Date.now();
    let animationFrameId;

    function animate() {
        const elapsedTime = Date.now() - startTime;
        let progress = Math.min(elapsedTime / spinDuration, 1);

        // Funkcja ułatwiająca animację (ease-out quint)
        const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
        const easedProgress = easeOutQuint(progress);

        // Oblicz aktualną rotację koła podczas animacji
        const spinTotalDelta = finalRotationAbsolute - initialWheelRotation;
        const currentAnimatedRotation = initialWheelRotation + (spinTotalDelta * easedProgress);

        canvas.style.transform = `rotate(${currentAnimatedRotation}deg)`;

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Animacja zakończona, ustaw ostateczną rotację
            currentRotation = finalRotationAbsolute; // Zaktualizuj currentRotation na końcową wartość
            canvas.style.transform = `rotate(${currentRotation}deg)`; // Upewnij się, że koło zatrzymuje się dokładnie w miejscu

            const originalCount = uniqueParticipantCounts.get(winnerSegment.name) || 0;
            resultDiv.textContent = `Gratulacje! Wylosowana osoba: ${winnerSegment.name} (liczba wpisów: ${originalCount})`; // Zmieniony tekst
            generateConfetti(); // Wywołaj konfetti

            spinButton.disabled = false;
            fileInput.disabled = false;
            isSpinning = false;
            // --- DIAGNOSTYKA ---
            console.log("Zakończono animację. Wynik:", winnerSegment.name, "z liczbą wpisów:", originalCount);
            console.log("Końcowa pozycja koła:", currentRotation.toFixed(2), "deg");
            // --- KONIEC DIAGNOSTYKI ---
        }
    }

    animationFrameId = requestAnimationFrame(animate);
}

// Obsługa wczytywania pliku TXT
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n')
                               .map(line => line.trim()) // Usuń białe znaki z początku i końca
                               .filter(line => line !== ''); // Odfiltruj puste linie

            if (lines.length === 0) {
                resultDiv.textContent = 'Brak poprawnych danych do wczytania.';
                spinButton.disabled = true;
                normalizedParticipants = [];
                uniqueParticipantCounts.clear();
                drawWheel();
                return;
            }

            // Krok 1: Oblicz unikalne liczby wystąpień dla wyświetlania statystyk
            uniqueParticipantCounts.clear();
            lines.forEach(line => {
                uniqueParticipantCounts.set(line, (uniqueParticipantCounts.get(line) || 0) + 1);
            });

            // Krok 2: Przygotuj normalizedParticipants, gdzie każda linia to osobny segment
            const totalSegments = lines.length;
            let currentAngle = 0;
            normalizedParticipants = lines.map((name, index) => {
                const percentage = (1 / totalSegments); // Każdy segment ma równą wagę
                const start = currentAngle;
                const end = currentAngle + (percentage * 2 * Math.PI);
                currentAngle = end; // Aktualizuj dla następnego
                return {
                    id: index, // Unikalne ID dla każdego segmentu (jego indeks)
                    name: name,
                    normalizedPercentage: percentage, // normalizedPercentage dla rysowania i losowania
                    startAngle: start, // Kąt początkowy wycinka
                    endAngle: end // Kąt końcowy wycinka
                };
            });

            if (normalizedParticipants.length > 0) {
                drawWheel();
                spinButton.disabled = false;
                // Wyświetl unikalne osoby i całkowitą liczbę wpisów
                resultDiv.textContent = `Wczytano ${uniqueParticipantCounts.size} unikalnych osób (łącznie ${normalizedParticipants.length} wpisów). Gotowe do kręcenia!`;
            } else {
                resultDiv.textContent = 'Brak danych do wczytania po przetworzeniu pliku.';
                spinButton.disabled = true;
            }
            console.log("Unikalne osoby i ich liczniki:", uniqueParticipantCounts);
            console.log("Wszystkie segmenty na kole (normalizedParticipants):", normalizedParticipants);
        };
        reader.readAsText(file);
    } else {
        // Obsługa usunięcia pliku z inputu
        normalizedParticipants = [];
        uniqueParticipantCounts.clear();
        spinButton.disabled = true;
        drawWheel();
        resultDiv.textContent = '';
    }
});

// Obsługa kliknięcia przycisku "Zakręć kołem!"
spinButton.addEventListener('click', spinWheel);

// Początkowe rysowanie koła przy ładowaniu strony
drawWheel();
