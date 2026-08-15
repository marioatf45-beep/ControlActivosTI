(function (global) {
    "use strict";

    const $ = id => document.getElementById(id);
    const esc = valor => global.Auth.escape(valor);
    const client = () => global.ControlTISupabase.client;

    async function mensajeFuncion(error, data, fallback) {
        if (data?.message) return data.message;
        if (error?.context?.json) {
            try { return (await error.context.json())?.message || fallback; } catch (_) {}
        }
        return fallback;
    }

    global.UsuariosSistema = {
        modal: null,

        async iniciar() {
            if (!Auth.requiereAdmin()) return;

            this.modal = bootstrap.Modal.getOrCreateInstance(
                $("modalUsuarioSistema")
            );

            this.eventos();

            await Auth.refrescarUsuarios();
            this.renderizar();
        },

        eventos() {
            $("btnNuevoUsuario").onclick = () => this.nuevo();

            $("formUsuarioSistema").onsubmit = event =>
                this.guardar(event);

            $("tablaUsuarios").onclick = event => {
                const boton = event.target.closest(
                    "button[data-action]"
                );

                if (!boton) return;

                const usuario = Auth.usuarios().find(
                    item => item.id === boton.dataset.id
                );

                if (!usuario) return;

                if (boton.dataset.action === "edit") {
                    this.editar(usuario);
                } else if (boton.dataset.action === "reset") {
                    this.editar(usuario);
                } else if (boton.dataset.action === "delete") {
                    this.desactivar(usuario);
                }
            };
        },

        nuevo() {
            Swal.fire({
                icon: "info",
                title: "Alta centralizada",
                text:
                    "El usuario debe registrarse desde el portal. " +
                    "Después podrás asignarle aquí el rol correspondiente."
            });
        },

        editar(usuario) {
            $("usuarioSistemaId").value = usuario.id;
            $("usuarioSistemaNombre").value = usuario.nombre;
            $("usuarioSistemaLogin").value = usuario.login;
            $("usuarioSistemaRol").value = usuario.rol;

            $("usuarioSistemaClave").value = "";
            $("usuarioSistemaClave").required = false;

            // El módulo Usuarios ya está protegido con Auth.requiereAdmin().
            // La Edge Function vuelve a validar que sea admin en el servidor.
            $("usuarioSistemaClave").disabled = false;

            $("usuarioSistemaActivo").checked = usuario.activo;

            $("ayudaClaveUsuario").textContent =
                "Opcional: escribe una contraseña nueva. " +
                "Déjala vacía para conservar la actual.";

            this.modal.show();
        },

        async guardar(event) {
            event.preventDefault();

            const id = $("usuarioSistemaId").value;
            const nuevaClave = $("usuarioSistemaClave").value;

            const anterior = Auth.usuarios().find(
                item => item.id === id
            );

            if (!anterior) {
                return Swal.fire(
                    "Usuario no encontrado",
                    "No se encontró el usuario que intentas modificar.",
                    "error"
                );
            }

            if (
                anterior.id === Auth.usuario.id &&
                !$("usuarioSistemaActivo").checked
            ) {
                return Swal.fire(
                    "Acción no permitida",
                    "No puedes desactivar tu propia cuenta.",
                    "warning"
                );
            }

            if (nuevaClave) {
                const claveValida =
                    nuevaClave.length >= 12 &&
                    /[A-Z]/.test(nuevaClave) &&
                    /[a-z]/.test(nuevaClave) &&
                    /[0-9]/.test(nuevaClave) &&
                    /[^A-Za-z0-9]/.test(nuevaClave);

                if (!claveValida) {
                    return Swal.fire(
                        "Contraseña no válida",
                        "Debe tener mínimo 12 caracteres, una mayúscula, " +
                        "una minúscula, un número y un carácter especial.",
                        "warning"
                    );
                }
            }

            const { data, error } = await client().functions.invoke("admin-manage-user", {
                body: {
                    userId: id,
                    fullName: $("usuarioSistemaNombre").value.trim(),
                    login: $("usuarioSistemaLogin").value.trim().toLowerCase(),
                    role: $("usuarioSistemaRol").value,
                    active: $("usuarioSistemaActivo").checked,
                    password: nuevaClave || undefined
                }
            });

            if (error || data?.success !== true) {
                console.error("admin-manage-user:", error || data);
                return Swal.fire("No se pudo guardar", await mensajeFuncion(error, data, "La operación administrativa no se completó."), "error");
            }

            await Auth.refrescarUsuarios();

            this.modal.hide();
            this.renderizar();

            Swal.fire({
                icon: "success",
                title: nuevaClave
                    ? "Usuario y contraseña actualizados"
                    : "Usuario actualizado",
                timer: 1700,
                showConfirmButton: false
            });
        },

        renderizar() {
            const items = Auth.usuarios();

            $("tablaUsuarios").innerHTML = items.map(usuario => `
                <tr>
                    <td>
                        <strong>${esc(usuario.login)}</strong>
                    </td>

                    <td>
                        ${esc(usuario.nombre)}
                    </td>

                    <td>
                        <span class="user-role">
                            ${esc(Auth.nombreRol(usuario.rol))}
                        </span>
                    </td>

                    <td>
                        <span class="user-state ${
                            usuario.activo ? "active" : "inactive"
                        }">
                            ${usuario.activo ? "Activo" : "Inactivo"}
                        </span>
                    </td>

                    <td>
                        ${
                            usuario.ultimoAcceso
                                ? new Date(
                                    usuario.ultimoAcceso
                                ).toLocaleString("es-MX")
                                : "Sin acceso"
                        }
                    </td>

                    <td class="text-end">
                        <button
                            class="btn btn-sm btn-outline-secondary"
                            data-action="edit"
                            data-id="${usuario.id}"
                            aria-label="Editar usuario ${esc(usuario.login)}"
                            title="Editar usuario">
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            class="btn btn-sm btn-outline-primary ms-1"
                            data-action="reset"
                            data-id="${usuario.id}"
                            aria-label="Cambiar contraseña de ${esc(usuario.login)}"
                            title="Cambiar contraseña">
                            <i class="fa-solid fa-key"></i>
                        </button>

                        ${
                            usuario.id !== Auth.usuario.id
                                ? `
                                    <button
                                        class="btn btn-sm btn-outline-danger ms-1"
                                        data-action="delete"
                                        data-id="${usuario.id}"
                                        aria-label="Desactivar usuario ${esc(usuario.login)}"
                                        title="Desactivar usuario">
                                        <i class="fa-solid fa-user-slash"></i>
                                    </button>
                                `
                                : ""
                        }
                    </td>
                </tr>
            `).join("");

            $("usuariosVacio").hidden = items.length > 0;
        },

        desactivar(usuario) {
            Swal.fire({
                icon: "warning",
                title: `¿Desactivar ${usuario.login}?`,
                text:
                    "El usuario quedará inactivo y ya no deberá " +
                    "tener acceso al portal.",
                showCancelButton: true,
                confirmButtonText: "Desactivar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#d7192d"
            }).then(async resultado => {
                if (!resultado.isConfirmed) return;

                const { data, error } = await client().functions.invoke("admin-manage-user", {
                    body: {
                        userId: usuario.id,
                        fullName: usuario.nombre,
                        login: usuario.login,
                        role: usuario.rol,
                        active: false
                    }
                });

                if (error || data?.success !== true) {
                    return Swal.fire("No se pudo desactivar", await mensajeFuncion(error, data, "No se pudo desactivar la cuenta."), "error");
                }

                await Auth.refrescarUsuarios();
                this.renderizar();

                Swal.fire({
                    icon: "success",
                    title: "Usuario desactivado",
                    timer: 1500,
                    showConfirmButton: false
                });
            });
        }
    };
})(window);
