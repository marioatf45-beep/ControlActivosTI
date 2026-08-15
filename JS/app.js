/* ==========================================================
   Control Activos TI v1.0.0
   app.js
========================================================== */

document.addEventListener("DOMContentLoaded", async () => {

    inicializarSistema();

    const configuracion = typeof obtenerConfiguracion === "function"
        ? obtenerConfiguracion()
        : {};
    const logoEmpresa = document.querySelector(".brand-logo");
    if (logoEmpresa && configuracion.logo) {
        logoEmpresa.src = configuracion.logo;
    }

    if (typeof Auth !== "undefined") {
        await Auth.iniciar();
    }

    if (typeof cargarDashboard === "function") {
        cargarDashboard();
    }

    configurarMenu();

    configurarNavegacion();

    if (typeof ServiceDeskMini !== "undefined") {
        ServiceDeskMini.iniciar();
    }

    if (typeof Auth !== "undefined") {
        if (Auth.usuario?.rol === "ServiceDesk") {
            document.querySelector('.sidebar a[data-page="servicedesk"]')?.click();
        } else {
            Auth.aplicarPagina("dashboard");
        }
    }

    console.log("Sistema iniciado correctamente.");

});

/* ==========================================================
   Menú lateral
========================================================== */

function configurarMenu() {

    const menuButton = document.getElementById("menuButton");
    const sidebar = document.querySelector(".sidebar");

    if (!menuButton || !sidebar) return;

    menuButton.addEventListener("click", () => {
        sidebar.classList.toggle("sidebar-close");
    });

}

/* ==========================================================
   Navegación
========================================================== */

function configurarNavegacion() {

    const enlaces = document.querySelectorAll(".sidebar a");

    enlaces.forEach(enlace => {

        enlace.addEventListener("click", function (e) {

            e.preventDefault();

            document.querySelectorAll(".sidebar li").forEach(li => {
                li.classList.remove("active");
            });

            this.parentElement.classList.add("active");

            const pagina = this.dataset.page;

            cargarPagina(pagina);

        });

    });

}
async function cargarPagina(pagina) {

    if (typeof Auth !== "undefined" && !Auth.puede(pagina)) {
        Swal.fire("Acceso restringido", "Tu rol no tiene permiso para abrir este módulo.", "warning");
        return;
    }

    const contenido = document.getElementById("contenidoPrincipal");

    if (!contenido) return;

    if (pagina === "dashboard") {

        location.reload();

        return;

    }

    try {

        const respuesta = await fetch(`Views/${pagina}.html`);

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar la página.");
        }

        contenido.innerHTML = await respuesta.text();

        if (pagina === "inventario" && typeof Inventario !== "undefined") {
            Inventario.iniciar();
        }

        if (pagina === "empleados" && typeof Empleados !== "undefined") {
            Empleados.iniciar();
        }

        if (pagina === "asignaciones" && typeof Asignaciones !== "undefined") {
            Asignaciones.iniciar();
        }

        if (pagina === "mantenimiento" && typeof Mantenimiento !== "undefined") {
            Mantenimiento.iniciar();
        }

        if (pagina === "reportes" && typeof Reportes !== "undefined") {
            Reportes.iniciar();
        }

        if (pagina === "gps" && typeof GPSUnidades !== "undefined") {
            GPSUnidades.iniciar();
        }

        if (pagina === "configuracion" && typeof Configuracion !== "undefined") {
            Configuracion.iniciar();
        }

        if (pagina === "depreciacion" && typeof Depreciacion !== "undefined") {
            Depreciacion.iniciar();
        }

        if (pagina === "usuarios" && typeof UsuariosSistema !== "undefined") {
            UsuariosSistema.iniciar();
        }

        if (pagina === "servicedesk" && typeof ServiceDesk !== "undefined") {
            ServiceDesk.iniciar();
        }

        if (pagina === "entradas-salidas" && typeof EntradasSalidas !== "undefined") {
            EntradasSalidas.iniciar();
        }

        if (typeof Auth !== "undefined") {
            Auth.aplicarPagina(pagina);
        }

    } catch (error) {

        contenido.innerHTML = `
            <div class="alert alert-danger">
                No se pudo cargar el módulo ${pagina}.
            </div>
        `;

        console.error(error);

    }

}
