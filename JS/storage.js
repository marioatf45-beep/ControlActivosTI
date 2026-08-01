/* ==========================================================
   Control Activos TI v1.0.0
   storage.js
   Gestión de LocalStorage
   ========================================================== */

const STORAGE_KEY = "ControlActivosTI";

/* ==========================================================
   Inicializar Base de Datos
========================================================== */

function inicializarSistema() {

    if (localStorage.getItem(STORAGE_KEY)) {
        return;
    }

    const database = {

        empresa: {
            nombre: "Soluciones On-Site",
            version: "1.0.0"
        },

        activos: [],

        empleados: [],

        asignaciones: [],

        unidades: [],

        usuariosSistema: [],

        tickets: [],

        mantenimientos: [],

        movimientos: [],

        configuracion: {
            tema: "light",
            idioma: "es",
            moneda: "MXN"
        }

    };

    guardarBaseDatos(database);

    console.log("Base de datos creada.");
}

/* ==========================================================
   Obtener Base de Datos
========================================================== */

function obtenerBaseDatos() {

    const data = localStorage.getItem(STORAGE_KEY);

    return data ? JSON.parse(data) : null;

}

/* ==========================================================
   Guardar Base de Datos
========================================================== */

function guardarBaseDatos(database) {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(database));

}

/* ==========================================================
   Reiniciar Sistema
========================================================== */

function reiniciarSistema() {

    localStorage.removeItem(STORAGE_KEY);

    inicializarSistema();

}

/* ==========================================================
   Activos
========================================================== */

function obtenerActivos() {

    return obtenerBaseDatos().activos;

}

function guardarActivos(activos) {

    const db = obtenerBaseDatos();

    db.activos = activos;

    guardarBaseDatos(db);

}

/* ==========================================================
   Empleados
========================================================== */

function obtenerEmpleados() {

    return obtenerBaseDatos().empleados;

}

function guardarEmpleados(lista) {

    const db = obtenerBaseDatos();

    db.empleados = lista;

    guardarBaseDatos(db);

}

/* ==========================================================
   Asignaciones
========================================================== */

function obtenerAsignaciones() {

    return obtenerBaseDatos().asignaciones;

}

function guardarAsignaciones(lista) {

    const db = obtenerBaseDatos();

    db.asignaciones = lista;

    guardarBaseDatos(db);

}

/* ==========================================================
   Mantenimientos
========================================================== */

function obtenerMantenimientos() {

    return obtenerBaseDatos().mantenimientos;

}

function guardarMantenimientos(lista) {

    const db = obtenerBaseDatos();

    db.mantenimientos = lista;

    guardarBaseDatos(db);

}

/* ==========================================================
   Movimientos
========================================================== */

function registrarMovimiento(tipo, descripcion) {

    const db = obtenerBaseDatos();

    db.movimientos.unshift({

        fecha: new Date().toLocaleString(),

        tipo: tipo,

        descripcion: descripcion

    });

    guardarBaseDatos(db);

}

/* ==========================================================
   Dashboard
========================================================== */

function obtenerEstadisticas() {

    const activos = obtenerActivos();

    return {

        total: activos.length,

        disponibles: activos.filter(a => a.estado === "Disponible").length,

        asignados: activos.filter(a => a.estado === "Asignado").length,

        reparacion: activos.filter(a => a.estado === "Reparación").length,

        baja: activos.filter(a => a.estado === "Baja").length

    };

}

function obtenerConfiguracion() {
    const db = obtenerBaseDatos();
    return {
        mesesMantenimiento: 6,
        moneda: "MXN",
        folioAsignacion: "RESP",
        folioMantenimiento: "MANT",
        folioTablet: "RTAB",
        ...(db && db.configuracion ? db.configuracion : {})
    };
}

/* ==========================================================
   GPS y Unidades
========================================================== */

function obtenerUnidades() {
    const db = obtenerBaseDatos();
    return Array.isArray(db.unidades) ? db.unidades : [];
}

function guardarUnidades(lista) {
    const db = obtenerBaseDatos();
    db.unidades = lista;
    guardarBaseDatos(db);
}

/* ==========================================================
   ServiceDesk
========================================================== */
function obtenerTickets() {
    const db = obtenerBaseDatos();
    return Array.isArray(db.tickets) ? db.tickets : [];
}

function guardarTickets(lista) {
    const db = obtenerBaseDatos();
    db.tickets = lista;
    guardarBaseDatos(db);
}
