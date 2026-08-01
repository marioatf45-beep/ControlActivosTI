
/* ==========================================================
   Control Activos TI
   Módulo Inventario
   crud.js
========================================================== */

const InventarioCRUD = {

    editando: false,
    indiceEditar: null,

    guardar() {

        if (!this.validarFormulario()) {
            return;
        }

        const activos = obtenerActivos();

        const activo = this.obtenerDatosFormulario();
        const ahora = new Date().toISOString();

        if (this.editando) {

            const anterior = activos[this.indiceEditar];
            activo.id = anterior.id || this.generarId();
            activo.creadoEn = anterior.creadoEn || ahora;
            activo.actualizadoEn = ahora;
            activo.cuentaTelefono = activo.categoria === "Teléfono" ? (anterior.cuentaTelefono || "") : "";
            activo.claveTelefonoCifrada = activo.categoria === "Teléfono" ? (anterior.claveTelefonoCifrada || null) : null;
            activos[this.indiceEditar] = activo;

            registrarMovimiento(
                "Edición",
                `Se editó el activo ${activo.activo}`
            );

            if ((anterior.empleadoId || "") !== (activo.empleadoId || "")) {
                registrarMovimiento(
                    activo.empleadoId ? "Asignación" : "Desasignación",
                    activo.empleadoId
                        ? `Se asignó el activo ${activo.activo} a ${activo.responsable}`
                        : `Se retiró el responsable del activo ${activo.activo}`
                );
            }

        } else {

            activo.id = this.generarId();
            activo.creadoEn = ahora;
            activo.actualizadoEn = ahora;
            activos.push(activo);

            registrarMovimiento(
                "Alta",
                `Se registró el activo ${activo.activo}`
            );

        }

        guardarActivos(activos);

        if (typeof Inventario !== "undefined") {
            Inventario.cargarTabla();
        }

        if (typeof refrescarDashboard === "function") {
            refrescarDashboard();
        }

        this.limpiarFormulario();

        bootstrap.Modal.getInstance(
            document.getElementById("modalActivo")
        ).hide();

        Swal.fire({
            icon: "success",
            title: this.editando ? "Activo actualizado" : "Activo registrado",
            timer: 1500,
            showConfirmButton: false
        });

        this.editando = false;
        this.indiceEditar = null;

    },

    editar(indice) {

        const activos = obtenerActivos();

        const activo = activos[indice];

        if (!activo) return;

        this.editando = true;

        this.indiceEditar = indice;

        document.getElementById("activo").value = activo.activo;
        document.getElementById("serie").value = activo.serie;
        document.getElementById("marca").value = activo.marca;
        document.getElementById("modelo").value = activo.modelo;
        document.getElementById("categoria").value = activo.categoria;
        document.getElementById("estado").value = activo.estado;
        document.getElementById("ubicacion").value = activo.ubicacion;
        if (typeof Inventario !== "undefined") {
            Inventario.cargarResponsables(
                activo.empleadoId || "",
                activo.responsable || ""
            );
        }
        document.getElementById("observaciones").value = activo.observaciones;
        document.getElementById("requisicion").value = activo.requisicion || "";
        document.getElementById("costoCompra").value = activo.costoCompra || "";
        document.getElementById("fechaCompra").value = activo.fechaCompra || "";
        document.getElementById("vidaUtil").value = String(activo.vidaUtil || 5);

        const modal = new bootstrap.Modal(
            document.getElementById("modalActivo")
        );

        modal.show();

    },

    eliminar(indice) {

        Swal.fire({

            title: "¿Eliminar activo?",

            text: "Esta acción no se puede deshacer.",

            icon: "warning",

            showCancelButton: true,

            confirmButtonText: "Eliminar",

            cancelButtonText: "Cancelar"

        }).then(resultado => {

            if (!resultado.isConfirmed) return;

            const activos = obtenerActivos();

            registrarMovimiento(
                "Eliminación",
                `Se eliminó el activo ${activos[indice].activo}`
            );

            activos.splice(indice,1);

            guardarActivos(activos);

            Inventario.cargarTabla();

            refrescarDashboard();

        });

    },

    obtenerDatosFormulario() {

        const selectorResponsable = document.getElementById("responsable");
        const opcionResponsable = selectorResponsable.options[
            selectorResponsable.selectedIndex
        ];
        const valorResponsable = selectorResponsable.value;

        return {

            activo: document.getElementById("activo").value.trim(),

            serie: document.getElementById("serie").value.trim(),

            marca: document.getElementById("marca").value.trim(),

            modelo: document.getElementById("modelo").value.trim(),

            categoria: document.getElementById("categoria").value,

            estado: document.getElementById("estado").value,

            ubicacion: document.getElementById("ubicacion").value.trim(),

            empleadoId: valorResponsable && valorResponsable !== "__anterior__"
                ? valorResponsable
                : "",

            responsable: opcionResponsable && valorResponsable
                ? opcionResponsable.dataset.nombre || opcionResponsable.textContent.trim()
                : "",

            observaciones: document.getElementById("observaciones").value.trim(),

            requisicion: document.getElementById("requisicion").value.trim().toUpperCase(),

            costoCompra: Number(document.getElementById("costoCompra").value) || 0,

            fechaCompra: document.getElementById("fechaCompra").value,

            vidaUtil: Number(document.getElementById("vidaUtil").value) || 5

        };

    },

    validarFormulario() {

        const activo = document.getElementById("activo").value.trim();

        const serie = document.getElementById("serie").value.trim();
        const estado = document.getElementById("estado").value;
        const responsable = document.getElementById("responsable").value;

        if (activo === "") {

            Swal.fire(
                "Campo requerido",
                "Debe capturar el número de activo.",
                "warning"
            );

            return false;

        }

        if (serie === "") {

            Swal.fire(
                "Campo requerido",
                "Debe capturar el número de serie.",
                "warning"
            );

            return false;

        }

        if (estado === "Asignado" && responsable === "") {

            Swal.fire(
                "Responsable requerido",
                "Selecciona un empleado activo para asignar el equipo.",
                "warning"
            );

            return false;

        }

        return true;

    },

    limpiarFormulario() {

        document.getElementById("formActivo").reset();

    },

    generarId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }

        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, caracter => {
            const aleatorio = Math.random() * 16 | 0;
            return (caracter === "x" ? aleatorio : (aleatorio & 3 | 8)).toString(16);
        });
    }

};

