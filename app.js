/* MVP Misterios Lógicos (sin backend) — versión robusta (sin ?. ni ??)
   - Carga dinámica JSON externo
   - Navegación SPA sin recargar
   - Tablero dinámico personajes x lugares
   - Pistas progresivas
   - Validación de solución
   - Progreso en localStorage
*/

var RUTAS = {
    INICIO: "inicio",
    PAQUETES: "paquetes",
    CASOS: "casos",
    JUEGO: "juego"
};

var STORAGE_KEY = "misterios_progreso_v1";

var state = {
    datos: null,
    ruta: RUTAS.INICIO,
    paqueteActualId: null,
    casoActualId: null,
    pistasReveladas: 0,
    tablero: {}, // clave: `${personajeId}_${lugarId}` => "unknown" | "yes" | "no"
    progreso: {
        completados: {} // { [casoId]: { correcto: true, intentos: n, fecha: iso } }
    }
};

// ------------------------- Utilidades -------------------------

function $(id) {
    return document.getElementById(id);
}

function safeText(s) {
    if (s === null || s === undefined) return "";
    return String(s);
}

function getOr(obj, pathArr, fallback) {
    // pathArr ejemplo: ["paquetes"] o ["completados", casoId, "correcto"]
    if (!obj) return fallback;
    var cur = obj;
    for (var i = 0; i < pathArr.length; i++) {
        var key = pathArr[i];
        if (cur && Object.prototype.hasOwnProperty.call(cur, key)) {
            cur = cur[key];
        } else {
            return fallback;
        }
    }
    return (cur === null || cur === undefined) ? fallback : cur;
}

function setText(id, value) {
    var el = $(id);
    if (!el) return;
    el.textContent = value;
}

function emojiDeIcono(icono) {
    var mapa = {
        school: "🏫",
        farm: "🚜",
        space: "🚀",
        rocket: "🚀",
        star: "⭐",
        leaf: "🌿"
    };
    return mapa[icono] || "🧩";
}

function estrellas(d) {
    var n = Math.max(1, Math.min(3, Number(d) || 1));
    return "⭐".repeat(n) + "☆".repeat(3 - n);
}

function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function() { t.classList.remove("show"); }, 1600);
}

function cargarProgreso() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            state.progreso = parsed;
            if (!state.progreso.completados) state.progreso.completados = {};
        }
    } catch (_e) {}
}

function guardarProgreso() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progreso));
    } catch (_e) {}
}

function resetearProgreso() {
    // 1) Borrar progreso global
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {}

    // 2) Borrar estados guardados por caso (tablero + pistas)
    try {
        for (var i = localStorage.length - 1; i >= 0; i--) {
            var k = localStorage.key(i);
            if (k && k.indexOf("misterios_estado_caso_") === 0) {
                localStorage.removeItem(k);
            }
        }
    } catch (_e) {}

    // 3) Resetear estado en memoria
    state.progreso = { completados: {} };
    state.pistasReveladas = 0;
    state.tablero = {};
    state.casoActualId = null;
    state.paqueteActualId = null;

    // 4) UI: volver a inicio y repintar
    setRuta(RUTAS.INICIO);
    renderPaquetes(); // deja listo para cuando pulse "Comenzar"

    toast("¡Progreso reiniciado! 🧹");
}

// ------------------------- Navegación -------------------------

function setRuta(ruta) {
    state.ruta = ruta;

    var screens = [
        $("screenInicio"),
        $("screenPaquetes"),
        $("screenCasos"),
        $("screenJuego")
    ];

    for (var i = 0; i < screens.length; i++) {
        if (screens[i]) screens[i].classList.remove("screen-active");
    }

    var btnVolver = $("btnVolver");
    if (btnVolver) btnVolver.hidden = (ruta === RUTAS.INICIO);

    if (ruta === RUTAS.INICIO && $("screenInicio")) $("screenInicio").classList.add("screen-active");
    if (ruta === RUTAS.PAQUETES && $("screenPaquetes")) $("screenPaquetes").classList.add("screen-active");
    if (ruta === RUTAS.CASOS && $("screenCasos")) $("screenCasos").classList.add("screen-active");
    if (ruta === RUTAS.JUEGO && $("screenJuego")) $("screenJuego").classList.add("screen-active");
}

function volver() {
    if (state.ruta === RUTAS.JUEGO) {
        setRuta(RUTAS.CASOS);
        return;
    }
    if (state.ruta === RUTAS.CASOS) {
        setRuta(RUTAS.PAQUETES);
        return;
    }
    setRuta(RUTAS.INICIO);
}

// ------------------------- Carga de datos -------------------------

async function cargarCasos() {
    var estado = $("estadoCarga");
    if (estado) estado.textContent = "Cargando misterios… 🧠";

    try {
        var respuesta = await fetch("./data/casos.json");
        if (!respuesta.ok) throw new Error("No se pudo leer el archivo de casos.");
        var datos = await respuesta.json();

        if (!datos || !Array.isArray(datos.paquetes)) {
            throw new Error("El archivo de casos no tiene el formato esperado.");
        }

        state.datos = datos;
        if (estado) estado.textContent = "¡Listo! 🌈";
        toast("¡Misterios cargados! ✨");
        renderPaquetes();
    } catch (error) {
        console.error(error);
        if (estado) estado.textContent = "Ups… no puedo abrir los misterios 😿";
        mostrarErrorAmigable();
    }
}

function mostrarErrorAmigable() {
    var cont = $("screenInicio");
    if (!cont) return;

    var msg = document.createElement("div");
    msg.className = "card";
    msg.style.marginTop = "1rem";
    msg.innerHTML =
        '<div class="card-title">😿 No se pudo cargar el juego</div>' +
        '<p class="card-desc">' +
        'Puede que falte el archivo <strong>data/casos.json</strong> o que estés abriendo el HTML directamente sin servidor.' +
        '<br><br>' +
        'Truco: usa un servidor estático (por ejemplo, GitHub Pages) o una extensión tipo “Live Server”.' +
        '</p>';

    cont.appendChild(msg);
}

// ------------------------- Render de Paquetes/Casos -------------------------

function renderPaquetes() {
    var root = $("listaPaquetes");
    if (!root) return;

    root.innerHTML = "";

    var paquetes = getOr(state, ["datos", "paquetes"], []);
    for (var i = 0; i < paquetes.length; i++) {
        (function(p) {
            var card = document.createElement("button");
            card.className = "card";
            card.type = "button";
            card.style.border = "none";
            card.style.textAlign = "left";

            var icon = emojiDeIcono(p.icono);
            var color = p.color || "#4A6FA5";

            var completados = contarCompletadosEnPaquete(p.id);
            var total = (p.casos || []).length;

            card.innerHTML =
                '<div class="card-top">' +
                '  <div class="card-icon" style="background:' + color + '">' + icon + "</div>" +
                '  <div class="badge">' + completados + "/" + total + " ✅</div>" +
                "</div>" +
                '<div class="card-title">' + safeText(p.nombre) + "</div>" +
                '<p class="card-desc">' + safeText(p.descripcion) + "</p>";

            card.addEventListener("click", function() {
                state.paqueteActualId = p.id;
                renderCasos(p.id);
                setRuta(RUTAS.CASOS);
            });

            root.appendChild(card);
        })(paquetes[i]);
    }
}

function contarCompletadosEnPaquete(paqueteId) {
    var paquete = getPaquete(paqueteId);
    if (!paquete) return 0;

    var c = 0;
    var casos = paquete.casos || [];
    for (var i = 0; i < casos.length; i++) {
        var caso = casos[i];
        var correcto = getOr(state, ["progreso", "completados", caso.id, "correcto"], false);
        if (correcto) c++;
    }
    return c;
}

function renderCasos(paqueteId) {
    var paquete = getPaquete(paqueteId);
    if (!paquete) return;

    setText("tituloPaquete", safeText(paquete.nombre));
    setText("descPaquete", safeText(paquete.descripcion));

    var root = $("listaCasos");
    if (!root) return;
    root.innerHTML = "";

    var casos = paquete.casos || [];
    for (var i = 0; i < casos.length; i++) {
        (function(caso) {
            var card = document.createElement("button");
            card.className = "card";
            card.type = "button";
            card.style.border = "none";
            card.style.textAlign = "left";

            var comp = getOr(state, ["progreso", "completados", caso.id], null);
            var correcto = comp && comp.correcto === true;
            var intentos = comp && typeof comp.intentos === "number" ? comp.intentos : 0;

            var badge = correcto ? "✅ Resuelto" : "🧩 Pendiente";

            card.innerHTML =
                '<div class="card-top">' +
                '  <div class="badge">' + badge + "</div>" +
                '  <div class="badge">Intentos: ' + intentos + "</div>" +
                "</div>" +
                '<div class="card-title">' + safeText(caso.titulo) + "</div>" +
                '<p class="card-desc">' + safeText(caso.descripcion) + "</p>" +
                '<div class="stars" aria-label="Dificultad">' + estrellas(caso.dificultad) + "</div>";

            card.addEventListener("click", function() {
                iniciarCaso(caso.id);
            });

            root.appendChild(card);
        })(casos[i]);
    }
}

// ------------------------- Juego -------------------------

function iniciarCaso(casoId) {
    state.casoActualId = casoId;
    state.pistasReveladas = 0;
    state.tablero = {};

    var caso = getCasoActual();
    if (!caso) return;

    setText("tituloCaso", safeText(caso.titulo));
    setText("historiaCaso", safeText(caso.descripcion));

    var dif = Math.max(1, Math.min(3, Number(caso.dificultad) || 1));
    setText("dificultadCaso", estrellas(dif));

    renderPistas();
    renderTablero();
    renderObjetos();

    setText("boardNote", "Toca una casilla para cambiar: ? → ✅ → ❌ → ?");

    prepararResolverModal();
    const modalReglas = document.getElementById("modalReglas");
    if (modalReglas && typeof modalReglas.showModal === "function") {
        modalReglas.showModal();
    }
    setRuta(RUTAS.JUEGO);

    restaurarEstadoCaso();
}

function renderPistas() {
    var caso = getCasoActual();
    var root = $("listaPistas");
    if (!root) return;
    root.innerHTML = "";

    var pistas = (caso && caso.pistas) ? caso.pistas : [];
    var n = state.pistasReveladas;

    for (var i = 0; i < n; i++) {
        var li = document.createElement("li");
        li.textContent = safeText(pistas[i]);
        root.appendChild(li);
    }

    setText("progresoPistas", "Pistas: " + n + "/" + pistas.length);
}

function nuevaPista() {
    var caso = getCasoActual();
    var pistas = (caso && caso.pistas) ? caso.pistas : [];
    var total = pistas.length;

    if (state.pistasReveladas >= total) {
        toast("¡Ya tienes todas las pistas! 🕵️‍♀️");
        return;
    }
    state.pistasReveladas++;
    renderPistas();
    guardarEstadoCaso();
    toast("¡Nueva pista desbloqueada! 🔎");
}

function renderTablero() {
    var caso = getCasoActual();
    var personajes = (caso && caso.personajes) ? caso.personajes : [];
    var lugares = (caso && caso.lugares) ? caso.lugares : [];

    var table = $("tablero");
    if (!table) return;
    table.innerHTML = "";

    var thead = document.createElement("thead");
    var trh = document.createElement("tr");

    var corner = document.createElement("th");
    corner.textContent = "👧🧒\\📍";
    trh.appendChild(corner);

    for (var i = 0; i < lugares.length; i++) {
        var th = document.createElement("th");
        th.textContent = safeText(lugares[i].nombre);
        trh.appendChild(th);
    }

    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");

    for (var p = 0; p < personajes.length; p++) {
        var tr = document.createElement("tr");

        var rowHead = document.createElement("td");
        rowHead.className = "rowhead";
        rowHead.textContent = safeText(personajes[p].nombre);
        tr.appendChild(rowHead);

        for (var l = 0; l < lugares.length; l++) {
            var td = document.createElement("td");
            var key = personajes[p].id + "_" + lugares[l].id;
            var current = state.tablero[key] || "unknown";

            var wrap = document.createElement("div");
            wrap.className = "cell";

            var btn = document.createElement("button");
            btn.type = "button";
            btn.dataset.personaje = personajes[p].id;
            btn.dataset.lugar = lugares[l].id;
            btn.dataset.key = key;

            aplicarEstadoBoton(btn, current);

            btn.addEventListener("click", (function(k) {
                return function() {
                    var next = siguienteEstado(this.dataset.state);
                    state.tablero[k] = next;
                    aplicarEstadoBoton(this, next);
                    guardarEstadoCaso();
                };
            })(key));

            wrap.appendChild(btn);
            td.appendChild(wrap);
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
}

function siguienteEstado(s) {
    if (s === "unknown") return "yes";
    if (s === "yes") return "no";
    return "unknown";
}

function aplicarEstadoBoton(btn, estado) {
    btn.dataset.state = estado;

    btn.classList.remove("state-unknown", "state-yes", "state-no");

    if (estado === "yes") {
        btn.classList.add("state-yes");
        btn.textContent = "✅";
        btn.setAttribute("aria-label", "Sí");
    } else if (estado === "no") {
        btn.classList.add("state-no");
        btn.textContent = "❌";
        btn.setAttribute("aria-label", "No");
    } else {
        btn.classList.add("state-unknown");
        btn.textContent = "⬜";
        btn.setAttribute("aria-label", "Desconocido");
    }
}

function renderObjetos() {
    var caso = getCasoActual();
    var root = $("listaObjetos");
    if (!root) return;
    root.innerHTML = "";

    var objetos = (caso && caso.objetos) ? caso.objetos : [];
    var emojiPorDefecto = ["🥪", "⚽", "📚", "🧸", "✏️", "🧃", "🧩", "🪀", "🎨"];

    for (var i = 0; i < objetos.length; i++) {
        var div = document.createElement("div");
        div.className = "object-card";
        var e = emojiPorDefecto[i % emojiPorDefecto.length];
        div.innerHTML =
            '<div class="object-emoji" aria-hidden="true">' + e + "</div>" +
            "<div>" + safeText(objetos[i].nombre) + "</div>";
        root.appendChild(div);
    }
}

function prepararResolverModal() {
    var caso = getCasoActual();
    var personajes = (caso && caso.personajes) ? caso.personajes : [];
    var lugares = (caso && caso.lugares) ? caso.lugares : [];
    var objetos = (caso && caso.objetos) ? caso.objetos : [];

    var sC = $("selectCulpable");
    var sL = $("selectLugar");
    var sO = $("selectObjeto");
    if (!sC || !sL || !sO) return;

    sC.innerHTML = "";
    sL.innerHTML = "";
    sO.innerHTML = "";

    for (var i = 0; i < personajes.length; i++) {
        var optC = document.createElement("option");
        optC.value = personajes[i].id;
        optC.textContent = personajes[i].nombre;
        sC.appendChild(optC);
    }

    for (var j = 0; j < lugares.length; j++) {
        var optL = document.createElement("option");
        optL.value = lugares[j].id;
        optL.textContent = lugares[j].nombre;
        sL.appendChild(optL);
    }

    for (var k = 0; k < objetos.length; k++) {
        var optO = document.createElement("option");
        optO.value = objetos[k].id;
        optO.textContent = objetos[k].nombre;
        sO.appendChild(optO);
    }
}

function abrirResolver() {
    var modal = $("modalResolver");
    if (!modal) return;

    if (typeof modal.showModal === "function") modal.showModal();
    else toast("Tu navegador no soporta modales 😅");
}

function comprobarSolucion() {
    var caso = getCasoActual();
    if (!caso) return;

    var sC = $("selectCulpable");
    var sL = $("selectLugar");
    var sO = $("selectObjeto");
    if (!sC || !sL || !sO) return;

    var elegido = {
        culpable: sC.value,
        lugar: sL.value,
        objeto: sO.value
    };

    var ok =
        elegido.culpable === caso.solucion.culpable &&
        elegido.lugar === caso.solucion.lugar &&
        elegido.objeto === caso.solucion.objeto;

    var entry = state.progreso.completados[caso.id] || { correcto: false, intentos: 0, fecha: null };
    entry.intentos = (entry.intentos || 0) + 1;
    entry.fecha = new Date().toISOString();
    if (ok) entry.correcto = true;

    state.progreso.completados[caso.id] = entry;
    guardarProgreso();

    guardarEstadoCaso();

    var modalResolver = $("modalResolver");
    if (modalResolver) modalResolver.close();

    mostrarResultado(ok, caso);
}

function mostrarResultado(ok, caso) {
    var modal = $("modalResultado");
    var emoji = $("resultadoEmoji");
    var titulo = $("resultadoTitulo");
    var texto = $("resultadoTexto");
    if (!modal || !emoji || !titulo || !texto) return;

    if (ok) {
        emoji.textContent = "🎉✨";
        titulo.textContent = "¡Lo resolviste!";
        texto.textContent = safeText(caso.feedback_correcto) || "¡Genial! Tu deducción fue perfecta.";
    } else {
        emoji.textContent = "💪🙂";
        titulo.textContent = "¡Buen intento!";
        texto.textContent = safeText(caso.feedback_incorrecto) || "Casi… prueba a revisar las pistas y las marcas del tablero.";
    }

    if (typeof modal.showModal === "function") modal.showModal();
}

function reintentarCaso() {
    var modal = $("modalResultado");
    if (modal) modal.close();
    toast("¡Vamos otra vez! 🧠");
}

function volverACasos() {
    var modal = $("modalResultado");
    if (modal) modal.close();
    renderCasos(state.paqueteActualId);
    setRuta(RUTAS.CASOS);
}

// ------------------------- Persistencia por caso (tablero + pistas) -------------------------

function keyCasoEstado(casoId) {
    return "misterios_estado_caso_" + casoId;
}

function guardarEstadoCaso() {
    var casoId = state.casoActualId;
    if (!casoId) return;

    var payload = {
        pistasReveladas: state.pistasReveladas,
        tablero: state.tablero
    };

    try {
        localStorage.setItem(keyCasoEstado(casoId), JSON.stringify(payload));
    } catch (_e) {}
}

function restaurarEstadoCaso() {
    var casoId = state.casoActualId;
    if (!casoId) return;

    try {
        var raw = localStorage.getItem(keyCasoEstado(casoId));
        if (!raw) return;

        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            state.pistasReveladas = Math.max(0, parsed.pistasReveladas || 0);
            state.tablero = (parsed.tablero && typeof parsed.tablero === "object") ? parsed.tablero : {};
            renderPistas();
            renderTablero();
        }
    } catch (_e) {}
}

// ------------------------- Getters -------------------------

function getPaquete(paqueteId) {
    var paquetes = getOr(state, ["datos", "paquetes"], []);
    for (var i = 0; i < paquetes.length; i++) {
        if (paquetes[i].id === paqueteId) return paquetes[i];
    }
    return null;
}

function getCasoActual() {
    var paquete = getPaquete(state.paqueteActualId);
    if (!paquete) return null;

    var casos = paquete.casos || [];
    for (var i = 0; i < casos.length; i++) {
        if (casos[i].id === state.casoActualId) return casos[i];
    }
    return null;
}

// ------------------------- Eventos UI -------------------------

function wireUI() {
    var btnComenzar = $("btnComenzar");
    if (btnComenzar) btnComenzar.addEventListener("click", function() {
        setRuta(RUTAS.PAQUETES);
    });

    var btnVolver = $("btnVolver");
    if (btnVolver) btnVolver.addEventListener("click", volver);

    var btnNuevaPista = $("btnNuevaPista");
    if (btnNuevaPista) btnNuevaPista.addEventListener("click", nuevaPista);

    var btnResolver = $("btnResolver");
    if (btnResolver) btnResolver.addEventListener("click", abrirResolver);

    var btnEnviarSolucion = $("btnEnviarSolucion");
    if (btnEnviarSolucion) btnEnviarSolucion.addEventListener("click", function(e) {
        e.preventDefault();
        comprobarSolucion();
    });

    var btnReintentar = $("btnReintentar");
    if (btnReintentar) btnReintentar.addEventListener("click", reintentarCaso);

    var btnSeguirJugando = $("btnSeguirJugando");
    if (btnSeguirJugando) btnSeguirJugando.addEventListener("click", volverACasos);

    var btnReiniciar = $("btnReiniciarProgreso");
    if (btnReiniciar) btnReiniciar.addEventListener("click", resetearProgreso);

    var btnCerrarReglas = $("btnCerrarReglas");
    if (btnCerrarReglas) {
        btnCerrarReglas.addEventListener("click", function() {
            var modal = $("modalReglas");
            if (modal) modal.close();
        });
    }
}

// ------------------------- Init -------------------------

(function init() {
    cargarProgreso();
    wireUI();
    setRuta(RUTAS.INICIO);
    cargarCasos();
})();