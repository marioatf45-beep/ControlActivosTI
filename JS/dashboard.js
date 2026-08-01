/* ==========================================================
   Control Activos TI
   dashboard.js
   Dashboard dinámico
========================================================== */

let chartCategorias = null;
let chartEstados = null;

/* ==========================================================
   Cargar Dashboard
========================================================== */

function cargarDashboard() {

    actualizarKPIs();

    cargarGraficas();

    cargarUltimosMovimientos();

    configurarPortalDashboard();

}

function configurarPortalDashboard() {
    const buscador = document.getElementById("buscarModuloDashboard");
    const contenedor = document.getElementById("modulosDashboard");
    if (!buscador || !contenedor) return;
    const botones = [...contenedor.querySelectorAll("button[data-page]")];
    buscador.addEventListener("input", () => {
        const texto = buscador.value.trim().toLowerCase();
        botones.forEach(boton => boton.hidden = Boolean(texto && !boton.textContent.toLowerCase().includes(texto)));
    });
    contenedor.addEventListener("click", evento => {
        const boton = evento.target.closest("button[data-page]");
        if (!boton) return;
        const enlace = document.querySelector(`.sidebar a[data-page="${boton.dataset.page}"]`);
        if (enlace) enlace.click();
    });
}

/* ==========================================================
   KPIs
========================================================== */

function actualizarKPIs() {

    const stats = obtenerEstadisticas();
    const indicadores = {
        totalActivos: stats.total,
        disponibles: stats.disponibles,
        asignados: stats.asignados,
        reparacion: stats.reparacion
    };

    Object.entries(indicadores).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });

}

/* ==========================================================
   Gráfica Categorías
========================================================== */

function cargarGraficas() {

    const activos = obtenerActivos();

    const categorias = {};

    activos.forEach(a => {

        categorias[a.categoria] = (categorias[a.categoria] || 0) + 1;

    });

    const ctx = document.getElementById("graficaCategorias");

    if (!ctx) return;

    if (chartCategorias) {

        chartCategorias.destroy();

    }

    chartCategorias = new Chart(ctx, {

        type: "doughnut",

        data: {

            labels: Object.keys(categorias),

            datasets: [{

                data: Object.values(categorias)

            }]

        },

        options: {

            responsive: true,

            plugins: {

                legend: {

                    position: "bottom"

                }

            }

        }

    });

}

/* ==========================================================
   Últimos movimientos
========================================================== */

function cargarUltimosMovimientos() {

    const db = obtenerBaseDatos();
    const tabla = document.getElementById("tablaMovimientos");

    if (!tabla || !db) return;

    tabla.innerHTML = "";

    db.movimientos.slice(0, 10).forEach(item => {

        const fila = document.createElement("tr");

        fila.innerHTML =
            "<td>" + item.fecha + "</td>" +
            "<td>" + item.tipo + "</td>" +
            "<td>" + item.descripcion + "</td>";

        tabla.appendChild(fila);

    });

}

/* ==========================================================
   Refrescar Dashboard
========================================================== */

function refrescarDashboard() {

    actualizarKPIs();

    cargarGraficas();

    cargarUltimosMovimientos();

}
