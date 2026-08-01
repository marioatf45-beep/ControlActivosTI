(function (global) {
    "use strict";
    const limpiar = valor => String(valor == null ? "" : valor).trim();
    const uuid = () => global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() :
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === "x" ? r : (r & 3 | 8)).toString(16);
        });

    const EmpleadosCRUD = {
        listar() { return obtenerEmpleados().map(item => ({ ...item })); },
        obtener(id) { return this.listar().find(item => item.id === id) || null; },
        numeroDisponible(numero, ignorarId) {
            const buscado = limpiar(numero).toLocaleLowerCase("es-MX");
            return !this.listar().some(item =>
                limpiar(item.numeroEmpleado).toLocaleLowerCase("es-MX") === buscado &&
                item.id !== ignorarId);
        },
        guardar(datos) {
            const item = this.normalizar(datos);
            if (!item.numeroEmpleado || !item.nombres || !item.apellidos || !item.departamento || !item.puesto)
                throw new Error("Completa todos los campos obligatorios.");
            if (!this.numeroDisponible(item.numeroEmpleado, item.id))
                throw new Error("El número de empleado ya está registrado.");
            if (item.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.correo))
                throw new Error("El correo electrónico no es válido.");

            const lista = obtenerEmpleados();
            const ahora = new Date().toISOString();
            if (item.id) {
                const indice = lista.findIndex(actual => actual.id === item.id);
                if (indice < 0) throw new Error("El registro ya no existe.");
                lista[indice] = { ...lista[indice], ...item, actualizadoEn: ahora };
                guardarEmpleados(lista);
                return { ...lista[indice] };
            }
            const nuevo = { ...item, id: uuid(), creadoEn: ahora, actualizadoEn: ahora };
            lista.push(nuevo);
            guardarEmpleados(lista);
            return { ...nuevo };
        },
        eliminar(id) {
            const lista = obtenerEmpleados();
            const resultado = lista.filter(item => item.id !== id);
            if (resultado.length === lista.length) return false;
            guardarEmpleados(resultado);
            return true;
        },
        normalizar(d) {
            return {
                id:limpiar(d.id), numeroEmpleado:limpiar(d.numeroEmpleado), nombres:limpiar(d.nombres),
                apellidos:limpiar(d.apellidos), empresa:limpiar(d.empresa), departamento:limpiar(d.departamento),
                puesto:limpiar(d.puesto), correo:limpiar(d.correo).toLowerCase(), telefono:limpiar(d.telefono),
                extension:limpiar(d.extension), ubicacion:limpiar(d.ubicacion),
                estatus:d.estatus === "Inactivo" ? "Inactivo" : "Activo", fechaIngreso:limpiar(d.fechaIngreso),
                jefeInmediato:limpiar(d.jefeInmediato), centroCosto:limpiar(d.centroCosto), foto:limpiar(d.foto)
            };
        }
    };
    global.EmpleadosCRUD = EmpleadosCRUD;
})(window);
