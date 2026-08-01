/* ==========================================================
   Control Activos TI v1.0.0
   Módulo Inventario
   Archivo: inventario.js
========================================================== */

const Inventario = {

    tabla: null,

    iniciar() {

        const tabla = document.getElementById("tablaInventario");

        if (!tabla) {
            return;
        }

        console.log("Módulo Inventario iniciado");

        this.cargarResponsables();
        this.cargarTabla();
        this.configurarEventos();

    },

    /* ======================================================
       Eventos
    ====================================================== */

    configurarEventos() {

        const btnGuardar = document.getElementById("btnGuardarActivo");
        const buscar = document.getElementById("buscarActivo");
        const filtroCategoria = document.getElementById("filtroCategoria");
        const filtroEstado = document.getElementById("filtroEstado");
        const btnExportar = document.getElementById("btnExportarInventario");
        const modalActivo = document.getElementById("modalActivo");
        const responsable = document.getElementById("responsable");

        if (btnGuardar) {

            btnGuardar.onclick = () => {
                InventarioCRUD.guardar();
            };

        }

        if (buscar) {

            buscar.oninput = () => {
                this.aplicarFiltros();
            };

        }

        if (filtroCategoria) {

            filtroCategoria.onchange = () => {
                this.aplicarFiltros();
            };

        }

        if (filtroEstado) {

            filtroEstado.onchange = () => {
                this.aplicarFiltros();
            };

        }

        if (btnExportar) {

            btnExportar.onclick = () => {
                this.exportarExcel();
            };

        }

        if (responsable) {
            responsable.onchange = () => {
                const estado = document.getElementById("estado");
                if (!estado) return;
                if (responsable.value) estado.value = "Asignado";
                else if (estado.value === "Asignado") estado.value = "Disponible";
            };
        }

        if (modalActivo) {

            modalActivo.addEventListener("hidden.bs.modal", () => {

                InventarioCRUD.limpiarFormulario();
                InventarioCRUD.editando = false;
                InventarioCRUD.indiceEditar = null;
                this.cargarResponsables();

                const titulo = modalActivo.querySelector(".modal-title");

                if (titulo) {
                    titulo.textContent = "Registro de activo";
                }

            });

        }

    },

    cargarResponsables(seleccionId = "", nombreAnterior = "") {

        const selector = document.getElementById("responsable");
        if (!selector) return;

        const empleados = typeof obtenerEmpleados === "function" ? obtenerEmpleados() : [];
        const normalizar = valor => (valor || "").trim().toLocaleLowerCase("es-MX");

        selector.replaceChildren(new Option("Sin asignar", ""));

        empleados
            .filter(empleado => empleado.estatus === "Activo" || empleado.id === seleccionId)
            .sort((a, b) => ((a.apellidos || "") + (a.nombres || ""))
                .localeCompare((b.apellidos || "") + (b.nombres || ""), "es"))
            .forEach(empleado => {
                const nombre = [empleado.nombres, empleado.apellidos].filter(Boolean).join(" ");
                const detalle = [empleado.numeroEmpleado, empleado.departamento].filter(Boolean).join(" · ");
                const opcion = new Option(
                    nombre + (detalle ? " — " + detalle : "") +
                    (empleado.estatus === "Inactivo" ? " (Inactivo)" : ""),
                    empleado.id
                );
                opcion.dataset.nombre = nombre;
                selector.add(opcion);
            });

        let valorSeleccionado = seleccionId;

        if (!valorSeleccionado && nombreAnterior) {
            const coincidencia = empleados.find(empleado =>
                normalizar([empleado.nombres, empleado.apellidos].filter(Boolean).join(" ")) ===
                normalizar(nombreAnterior));
            valorSeleccionado = coincidencia ? coincidencia.id : "";
        }

        if (valorSeleccionado && Array.from(selector.options).some(opcion => opcion.value === valorSeleccionado)) {
            selector.value = valorSeleccionado;
        } else if (nombreAnterior) {
            const opcionAnterior = new Option(nombreAnterior + " — registro anterior", "__anterior__");
            opcionAnterior.dataset.nombre = nombreAnterior;
            selector.add(opcionAnterior);
            selector.value = "__anterior__";
        }

    },

    /* ======================================================
       Tabla
    ====================================================== */

    cargarTabla() {

        const tbody = document.querySelector("#tablaInventario tbody");

        if (!tbody) {
            return;
        }

        if (this.tabla) {

            this.tabla.destroy();
            this.tabla = null;

        }

        tbody.innerHTML = "";

        const activos = obtenerActivos();

        activos.forEach((activo, index) => {

            const fila = document.createElement("tr");

            fila.innerHTML =
                "<td>" + this.escaparTexto(activo.activo) + "</td>" +
                "<td>" + this.escaparTexto(activo.serie) + "</td>" +
                "<td>" + this.escaparTexto(activo.marca) + "</td>" +
                "<td>" + this.escaparTexto(activo.modelo) + "</td>" +
                "<td>" + this.escaparTexto(activo.categoria) + "</td>" +
                "<td>" + this.crearEtiquetaEstado(activo.estado) + "</td>" +
                "<td>" + this.escaparTexto(activo.ubicacion) + "</td>" +
                "<td>" + this.escaparTexto(activo.responsable) + "</td>" +
                '<td class="text-nowrap">' +
                    '<button type="button" ' +
                        'class="btn btn-info btn-sm me-1" ' +
                        'title="Código QR" ' +
                        'onclick="Inventario.mostrarQR(' + index + ')">' +
                        '<i class="fa-solid fa-qrcode"></i>' +
                    "</button>" +
                    (activo.categoria === "Teléfono" ?
                        '<button type="button" class="btn btn-dark btn-sm me-1" title="Credenciales del celular" onclick="Inventario.credencialesTelefono(' + index + ')"><i class="fa-solid fa-key"></i></button>'
                        : "") +
                    '<button type="button" ' +
                        'class="btn btn-warning btn-sm me-1" ' +
                        'title="Editar activo" ' +
                        'onclick="InventarioCRUD.editar(' + index + ')">' +
                        '<i class="fa-solid fa-pen-to-square"></i>' +
                    "</button>" +
                    '<button type="button" ' +
                        'class="btn btn-danger btn-sm" ' +
                        'title="Eliminar activo" ' +
                        'onclick="InventarioCRUD.eliminar(' + index + ')">' +
                        '<i class="fa-solid fa-trash"></i>' +
                    "</button>" +
                "</td>";

            tbody.appendChild(fila);

        });

        this.tabla = new DataTable("#tablaInventario", {

            pageLength: 10,

            order: [[0, "asc"]],

            columnDefs: [
                {
                    targets: 8,
                    orderable: false,
                    searchable: false
                }
            ],

            language: {

                search: "Buscar:",

                lengthMenu: "Mostrar _MENU_ registros",

                info: "Mostrando _START_ a _END_ de _TOTAL_ activos",

                infoEmpty: "No hay activos registrados",

                infoFiltered: "(filtrado de _MAX_ registros)",

                zeroRecords: "No se encontraron resultados",

                emptyTable: "No hay activos disponibles",

                paginate: {
                    first: "Primero",
                    last: "Último",
                    next: "Siguiente",
                    previous: "Anterior"
                }

            }

        });

    },

    /* ======================================================
       Filtros
    ====================================================== */

    aplicarFiltros() {

        if (!this.tabla) {
            return;
        }

        const buscar = document.getElementById("buscarActivo");
        const filtroCategoria = document.getElementById("filtroCategoria");
        const filtroEstado = document.getElementById("filtroEstado");

        const texto = buscar ? buscar.value.trim() : "";
        const categoria = filtroCategoria
            ? filtroCategoria.value
            : "";
        const estado = filtroEstado
            ? filtroEstado.value
            : "";

        this.tabla.search(texto);
        this.tabla.column(4).search(categoria);
        this.tabla.column(5).search(estado);
        this.tabla.draw();

    },

    /* ======================================================
       Exportar Excel
    ====================================================== */

    exportarExcel() {

        const activos = obtenerActivos();

        if (!activos.length) {

            Swal.fire({
                icon: "info",
                title: "Sin información",
                text: "No hay activos para exportar."
            });

            return;

        }

        if (typeof XLSX === "undefined") {

            Swal.fire({
                icon: "error",
                title: "Error",
                text: "La librería SheetJS no está disponible."
            });

            return;

        }

        const datos = activos.map((activo, index) => {

            const costo = Number(activo.costoCompra) || 0;
            const vida = Number(activo.vidaUtil) || 5;
            const compra = activo.fechaCompra ? new Date(activo.fechaCompra + "T12:00:00") : null;
            const antiguedad = compra ? Math.max(0, Math.floor((Date.now() - compra.getTime()) / 31557600000)) : 0;
            const depreciacion = Math.min(costo, (costo / vida) * antiguedad);

            return ({

            "#": index + 1,
            "Número de activo": activo.activo || "",
            "Número de serie": activo.serie || "",
            "Marca": activo.marca || "",
            "Modelo": activo.modelo || "",
            "Categoría": activo.categoria || "",
            "Estado": activo.estado || "",
            "Ubicación": activo.ubicacion || "",
            "Responsable": activo.responsable || "",
            "Requisición": activo.requisicion || "",
            "Costo de compra": costo,
            "Fecha de compra": activo.fechaCompra || "",
            "Vida útil (años)": vida,
            "Antigüedad (años)": antiguedad,
            "Depreciación acumulada": depreciacion,
            "Valor contable actual": Math.max(0, costo - depreciacion),
            "Observaciones": activo.observaciones || ""

        });
        });

        const hoja = XLSX.utils.json_to_sheet(datos);

        hoja["!cols"] = [
            { wch: 6 },
            { wch: 20 },
            { wch: 22 },
            { wch: 16 },
            { wch: 18 },
            { wch: 18 },
            { wch: 16 },
            { wch: 22 },
            { wch: 25 },
            { wch: 40 }
        ];

        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            libro,
            hoja,
            "Inventario"
        );

        const fecha = new Date()
            .toISOString()
            .slice(0, 10);

        XLSX.writeFile(
            libro,
            "Inventario_Activos_" + fecha + ".xlsx"
        );

        registrarMovimiento(
            "Exportación",
            "Se exportó el inventario de activos a Excel"
        );

        if (typeof refrescarDashboard === "function") {
            refrescarDashboard();
        }

        Swal.fire({
            icon: "success",
            title: "Inventario exportado",
            timer: 1500,
            showConfirmButton: false
        });

    },

    async credencialesTelefono(indice) {

        if (window.Auth && !Auth.requiereAdmin()) {
            return Swal.fire("Acceso restringido", "Solo un administrador puede consultar credenciales.", "warning");
        }

        const activos = obtenerActivos();
        const activo = activos[indice];
        if (!activo || activo.categoria !== "Teléfono") return;

        if (!window.CryptoVault || !CryptoVault.estaConfigurado()) {
            return Swal.fire({
                icon: "warning",
                title: "Seguridad pendiente",
                text: "Configura primero la clave maestra del administrador en Configuración."
            });
        }

        if (!activo.claveTelefonoCifrada) {
            const resultado = await Swal.fire({
                title: "Credenciales del celular",
                html:
                    '<label class="form-label w-100 text-start">Cuenta asignada</label>' +
                    '<input id="swalCuentaTelefono" class="swal2-input mt-0" autocomplete="off">' +
                    '<label class="form-label w-100 text-start">Contraseña del celular</label>' +
                    '<input id="swalClaveTelefono" type="password" class="swal2-input mt-0" autocomplete="new-password">' +
                    '<label class="form-label w-100 text-start">Clave maestra del administrador</label>' +
                    '<input id="swalClaveAdmin" type="password" class="swal2-input mt-0" autocomplete="current-password">',
                showCancelButton: true,
                confirmButtonText: "Cifrar y guardar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#d7192d",
                showLoaderOnConfirm: true,
                preConfirm: async () => {
                    const cuenta = document.getElementById("swalCuentaTelefono").value.trim();
                    const clave = document.getElementById("swalClaveTelefono").value;
                    const admin = document.getElementById("swalClaveAdmin").value;
                    if (!cuenta || !clave || !admin) return Swal.showValidationMessage("Completa los tres campos.");
                    try {
                        return { cuenta, cifrada: await CryptoVault.cifrar(clave, admin) };
                    } catch (error) {
                        Swal.showValidationMessage(error.message);
                    }
                },
                allowOutsideClick: () => !Swal.isLoading()
            });
            if (!resultado.isConfirmed) return;
            activos[indice] = {...activo, cuentaTelefono: resultado.value.cuenta, claveTelefonoCifrada: resultado.value.cifrada, actualizadoEn: new Date().toISOString()};
            guardarActivos(activos);
            registrarMovimiento("Credencial protegida", `Se guardó una cuenta cifrada para el celular ${activo.activo}`);
            return Swal.fire("Credenciales protegidas", "La contraseña quedó cifrada y requiere autenticación para mostrarse.", "success");
        }

        const acceso = await Swal.fire({
            title: "Autenticación del administrador",
            input: "password",
            inputLabel: `Revelar credenciales de ${activo.activo}`,
            inputPlaceholder: "Clave maestra",
            inputAttributes: { autocomplete: "current-password" },
            showCancelButton: true,
            confirmButtonText: "Autenticar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#d7192d",
            showLoaderOnConfirm: true,
            preConfirm: async clave => {
                try { return await CryptoVault.descifrar(activo.claveTelefonoCifrada, clave); }
                catch (error) { Swal.showValidationMessage(error.message); }
            },
            allowOutsideClick: () => !Swal.isLoading()
        });
        if (!acceso.isConfirmed) return;
        registrarMovimiento("Consulta protegida", `El administrador consultó las credenciales del celular ${activo.activo}`);
        Swal.fire({
            icon: "info",
            title: activo.activo,
            html: '<div class="text-start"><b>Cuenta:</b><div class="alert alert-light">' + this.escaparTexto(activo.cuentaTelefono) + '</div><b>Contraseña:</b><div class="alert alert-warning font-monospace">' + this.escaparTexto(acceso.value) + '</div></div>',
            confirmButtonText: "Ocultar",
            confirmButtonColor: "#d7192d"
        });
    },

    mostrarQR(indice) {
        const activo = obtenerActivos()[indice];
        if (!activo || !activo.id) {
            return Swal.fire("QR no disponible", "Guarda nuevamente el activo para generar su identificador.", "info");
        }
        if (typeof QRCode === "undefined") {
            return Swal.fire("QR no disponible", "Verifica la conexión y vuelve a intentarlo.", "error");
        }
        Swal.fire({
            title: activo.activo || "Código QR del activo",
            html: '<div id="qrActivoActual" class="d-flex justify-content-center my-3"></div><p class="small text-muted">Escanea este código desde Mantenimiento.</p>',
            didOpen: () => new QRCode(document.getElementById("qrActivoActual"), {
                text: "CONTROLTI|" + activo.id + "|" + (activo.activo || ""),
                width: 220,
                height: 220,
                correctLevel: QRCode.CorrectLevel.H
            }),
            confirmButtonText: "Cerrar"
        });
    },

    /* ======================================================
       Utilidades visuales
    ====================================================== */

    crearEtiquetaEstado(estado) {

        const clases = {
            "Disponible": "text-bg-success",
            "Asignado": "text-bg-primary",
            "Reparación": "text-bg-warning",
            "Baja": "text-bg-danger"
        };

        const clase = clases[estado] || "text-bg-secondary";

        return (
            '<span class="badge ' + clase + '">' +
            this.escaparTexto(estado) +
            "</span>"
        );

    },

    escaparTexto(valor) {

        const elemento = document.createElement("div");

        elemento.textContent = valor || "";

        return elemento.innerHTML;

    }

};
