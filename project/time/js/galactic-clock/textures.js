(function (app) {
function createClockFaceTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Фон
        context.fillStyle = 'rgba(20, 30, 50, 0.8)';
        context.beginPath();
        context.arc(256, 256, 256, 0, 2 * Math.PI);
        context.fill();
        
        // Градиент для края
        const gradient = context.createRadialGradient(256, 256, 230, 256, 256, 256);
        gradient.addColorStop(0, 'rgba(50, 100, 200, 0.2)');
        gradient.addColorStop(1, 'rgba(80, 150, 255, 0.6)');
        
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(256, 256, 256, 0, 2 * Math.PI);
        context.fill();
        
        // Внутренний круг
        context.fillStyle = 'rgba(10, 20, 40, 0.8)';
        context.beginPath();
        context.arc(256, 256, 220, 0, 2 * Math.PI);
        context.fill();
        
        // Цифры
        context.font = 'bold 36px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        for (let i = 1; i <= 12; i++) {
            const angle = (i - 3) * (Math.PI / 6);
            const x = 256 + Math.cos(angle) * 180;
            const y = 256 + Math.sin(angle) * 180;
            context.fillText(i.toString(), x, y);
        }
        
        // Маленькие метки минут
        context.strokeStyle = 'rgba(200, 200, 200, 0.8)';
        context.lineWidth = 2;
        
        for (let i = 0; i < 60; i++) {
            const angle = i * (Math.PI / 30);
            const length = i % 5 === 0 ? 15 : 8;
            
            context.beginPath();
            context.moveTo(256 + Math.cos(angle) * (220 - length), 256 + Math.sin(angle) * (220 - length));
            context.lineTo(256 + Math.cos(angle) * 220, 256 + Math.sin(angle) * 220);
            context.stroke();
        }
        
        // Логотип или бренд часов
        context.font = '20px Arial';
        context.fillStyle = 'rgba(150, 200, 255, 0.9)';
        context.fillText('GALACTIC TIME', 256, 160);
        
        return canvas;
    }

function createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        
        // Радиальный градиент для эффекта свечения
        const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 32);
        
        return canvas;
    }

function createNeonClockFace() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Фон
        context.fillStyle = 'rgba(0, 0, 20, 0.9)';
        context.beginPath();
        context.arc(256, 256, 256, 0, 2 * Math.PI);
        context.fill();
        
        // Неоновое свечение по краю
        const gradient = context.createRadialGradient(256, 256, 200, 256, 256, 256);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.7, 'rgba(80, 0, 180, 0.3)');
        gradient.addColorStop(0.9, 'rgba(180, 80, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 100, 255, 0.8)');
        
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(256, 256, 256, 0, 2 * Math.PI);
        context.fill();
        
        // Неоновая сетка
        context.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        context.lineWidth = 1;
        
        for (let i = 0; i < 360; i += 15) {
            const angle = i * Math.PI / 180;
            context.beginPath();
            context.moveTo(256, 256);
            context.lineTo(256 + Math.cos(angle) * 240, 256 + Math.sin(angle) * 240);
            context.stroke();
        }
        
        // Часовые метки в неоновом стиле
        for (let i = 1; i <= 12; i++) {
            const angle = (i - 3) * (Math.PI / 6);
            const x = 256 + Math.cos(angle) * 190;
            const y = 256 + Math.sin(angle) * 190;
            
            // Светящийся неоновый круг
            context.beginPath();
            context.arc(x, y, 15, 0, 2 * Math.PI);
            const circleGradient = context.createRadialGradient(x, y, 0, x, y, 15);
            circleGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            circleGradient.addColorStop(0.3, 'rgba(255, 100, 255, 0.8)');
            circleGradient.addColorStop(1, 'rgba(180, 0, 255, 0)');
            context.fillStyle = circleGradient;
            context.fill();
            
            // Номер часа
            context.font = 'bold 28px Arial';
            context.fillStyle = 'rgba(255, 255, 255, 0.9)';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(i.toString(), x, y);
        }
        
        // Логотип в неоновом стиле
        context.font = '24px Arial';
        const neonTextGradient = context.createLinearGradient(150, 160, 350, 160);
        neonTextGradient.addColorStop(0, '#ff00ff');
        neonTextGradient.addColorStop(0.5, '#00ffff');
        neonTextGradient.addColorStop(1, '#ff00ff');
        context.fillStyle = neonTextGradient;
        context.fillText('NEON CHRONO', 256, 160);
        
        return canvas;
    }

function createGalaxyClockFace() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Фон с имитацией галактики
        context.fillStyle = 'rgba(5, 5, 15, 0.9)';
        context.beginPath();
        context.arc(256, 256, 256, 0, 2 * Math.PI);
        context.fill();
        
        // "Звёзды" на циферблате
        for (let i = 0; i < 300; i++) {
            const r = Math.random() * 240;
            const angle = Math.random() * Math.PI * 2;
            const x = 256 + Math.cos(angle) * r;
            const y = 256 + Math.sin(angle) * r;
            const size = Math.random() * 2 + 0.5;
            
            context.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`;
            context.beginPath();
            context.arc(x, y, size, 0, 2 * Math.PI);
            context.fill();
        }
        
        // Спиральная галактика - рисуем спирали
        for (let i = 0; i < 2; i++) {
            const startAngle = i * Math.PI;
            context.strokeStyle = 'rgba(70, 100, 255, 0.3)';
            context.lineWidth = 6;
            
            for (let r = 10; r < 200; r += 5) {
                const angle = startAngle + (r / 30);
                const x = 256 + Math.cos(angle) * r;
                const y = 256 + Math.sin(angle) * r;
                
                context.beginPath();
                context.arc(x, y, 5, 0, 2 * Math.PI);
                context.stroke();
            }
        }
        
        // Часовые метки
        for (let i = 1; i <= 12; i++) {
            const angle = (i - 3) * (Math.PI / 6);
            const x = 256 + Math.cos(angle) * 200;
            const y = 256 + Math.sin(angle) * 200;
            
            // Светящиеся круги вокруг цифр
            context.beginPath();
            context.arc(x, y, 20, 0, 2 * Math.PI);
            const circleGradient = context.createRadialGradient(x, y, 0, x, y, 20);
            circleGradient.addColorStop(0, 'rgba(100, 150, 255, 0.8)');
            circleGradient.addColorStop(1, 'rgba(50, 100, 200, 0)');
            context.fillStyle = circleGradient;
            context.fill();
            
            // Номер часа
            context.font = 'bold 30px Arial';
            context.fillStyle = 'rgba(220, 230, 255, 0.9)';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(i.toString(), x, y);
        }
        
        // Логотип
        context.font = 'bold 26px Arial';
        context.fillStyle = 'rgba(150, 200, 255, 0.9)';
        context.fillText('COSMIC TIMEKEEPER', 256, 160);
        
        return canvas;
    }

function createMinimalClockFace() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Фон
        context.fillStyle = 'rgba(20, 20, 20, 0.9)';
        context.beginPath();
        context.arc(256, 256, 256, 0, 2 * Math.PI);
        context.fill();
        
        // Тонкое кольцо по краю
        context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(256, 256, 240, 0, 2 * Math.PI);
        context.stroke();
        
        // Минимальные метки часов - только линии
        for (let i = 0; i < 12; i++) {
            const angle = i * (Math.PI / 6);
            context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            context.lineWidth = i % 3 === 0 ? 3 : 1;
            
            context.beginPath();
            context.moveTo(256 + Math.cos(angle) * 210, 256 + Math.sin(angle) * 210);
            context.lineTo(256 + Math.cos(angle) * 240, 256 + Math.sin(angle) * 240);
            context.stroke();
        }
        
        // Только номера 12, 3, 6, 9
        context.font = '28px Arial';
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        const mainHours = [12, 3, 6, 9];
        for (let i = 0; i < mainHours.length; i++) {
            const hour = mainHours[i];
            const angle = (hour - 3) * (Math.PI / 6);
            const x = 256 + Math.cos(angle) * 180;
            const y = 256 + Math.sin(angle) * 180;
            context.fillText(hour.toString(), x, y);
        }
        
        // Минимальный бренд
        context.font = '20px Arial';
        context.fillStyle = 'rgba(255, 255, 255, 0.5)';
        context.fillText('MINIMALIST', 256, 160);
        
        return canvas;
    }

    app.textures = {
        createClockFaceTexture,
        createParticleTexture,
        createNeonClockFace,
        createGalaxyClockFace,
        createMinimalClockFace
    };
})(window.GalacticClock);
