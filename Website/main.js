// Theme toggle
(function() {
  var themeToggle = document.getElementById('themeToggle');
  var html = document.documentElement;
  var stored = localStorage.getItem('theme');
  if (stored === 'dark') html.setAttribute('data-theme', 'dark');

  themeToggle.addEventListener('click', function() {
    if (html.getAttribute('data-theme') === 'dark') {
      html.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    } else {
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
    updateAccentColor();
  });

  window.accentRGB = '30, 136, 229';
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + ', ' + g + ', ' + b;
  }
  function updateAccentColor() {
    var s = getComputedStyle(document.documentElement);
    var accent = s.getPropertyValue('--accent').trim();
    if (accent) window.accentRGB = hexToRgb(accent);
  }
  updateAccentColor();
})();

// Google Analytics
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-NV15KD2CVF');

// Mobile nav toggle
document.getElementById('navToggle').addEventListener('click', function() {
  document.getElementById('navLinks').classList.toggle('open');
});

document.querySelectorAll('#navLinks a').forEach(function(a) {
  a.addEventListener('click', function() {
    document.getElementById('navLinks').classList.remove('open');
  });
});

// Lightbox
var lightbox = document.getElementById('lightbox');
var lightboxImg = document.getElementById('lightboxImg');
var lightboxCaption = document.getElementById('lightboxCaption');
var lightboxClose = document.getElementById('lightboxClose');

function openLightbox(src, alt, caption) {
  lightboxImg.src = src;
  lightboxImg.alt = alt;
  lightboxCaption.textContent = caption;
  lightbox.classList.add('open');
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lightboxImg.src = '';
}

document.querySelectorAll('.screenshot-card').forEach(function(card) {
  card.addEventListener('click', function() {
    var img = card.querySelector('img');
    if (img) openLightbox(img.src, img.alt, card.querySelector('.cap').textContent.trim());
  });
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', function(e) {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeLightbox(); }
});

document.querySelectorAll('.pricing-btn').forEach(function(btn) {
  btn.addEventListener('dragstart', function(e) { e.preventDefault(); });
});

function contactForPurchase(product) {
  var subject = encodeURIComponent('Zestok Purchase - ' + product);
  var body = encodeURIComponent('Hi Usama,\n\nI would like to purchase ' + product + ' via NayaPay. Please share your NayaPay account details.\n\nThank you.');
  window.location.href = 'mailto:usamsohail2000@gmail.com?subject=' + subject + '&body=' + body;
}

// 3D Card Tilt on Mouse Move
(function() {
  var cards = document.querySelectorAll('.feature-card, .pricing-card, .how-step');
  cards.forEach(function(card) {
    card.addEventListener('mousemove', function(e) {
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      var rotateX = -y * 12;
      var rotateY = x * 12;
      card.style.transform = 'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateY(-6px) translateZ(15px)';
    });
    card.addEventListener('mouseleave', function() {
      card.style.transform = '';
    });
  });
})();

// 3D Parallax on Hero Mockup
(function() {
  var mockup = document.querySelector('.hero-mockup');
  if (!mockup) return;
  document.addEventListener('mousemove', function(e) {
    var x = (e.clientX / window.innerWidth - 0.5) * 2;
    var y = (e.clientY / window.innerHeight - 0.5) * -2;
    mockup.style.transform = 'perspective(1000px) rotateY(' + (x * 10) + 'deg) rotateX(' + (y * 8) + 'deg) translateZ(30px)';
  });
  document.addEventListener('mouseleave', function() {
    mockup.style.transform = '';
  });
})();

// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(function(q) {
  q.addEventListener('click', function() {
    var item = this.parentElement;
    var isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(function(i) { i.classList.remove('open'); });
    if (!isOpen) item.classList.add('open');
  });
});

// Floating Particles
(function() {
  var canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var particles = [];
  var count = 60;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (var i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 3 + 1,
      dx: (Math.random() - 0.5) * 0.5,
      dy: (Math.random() - 0.5) * 0.5,
      o: Math.random() * 0.4 + 0.1
    });
  }

  function drawParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function(p) {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + accentRGB + ', ' + p.o + ')';
      ctx.fill();
    });
    // Draw connections
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(' + accentRGB + ', ' + (0.05 * (1 - dist / 150)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(drawParticles);
  }
  drawParticles();
})();
