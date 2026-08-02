(function (global) {
    "use strict";

    const $ = id => document.getElementById(id);
    const esc = valor => global.Auth.escape(valor);
    const client = () => global.ControlTISupabase.client;

    global.UsuariosSistema = {
        modal: null,

        async iniciar() {
            if (!Auth.requiereAdmin()) return;
            this.modal = bootstrap.Modal.getOrCreateInstance($("modalUsuarioSistema"));
            this.eventos();
            await Auth.refrescarUsuarios();
            this.renderizar();
        },

        eventos() {
            $("btnNuevoUsuario").onclick = () => this.nuevo();
            $("formUsuarioSistema").onsubmit = event => this.guardar(event);
            $("tablaUsuarios").onclick = event => {
                const boton = event.target.closest("button[data-action]");
                if (!boton) return;
                const usuario = Auth.usuarios().find(item => item.id === boton.dataset.id);
                if (!usuario) return;
                if (boton.dataset.action === "edit") this.editar(usuario);
                else if (boton.dataset.action === "reset") this.restablecer(usuario);
                else this.desactivar(usuario);
            };
        },

        nuevo() {
            Swal.fire({
                icon: "info",
                title: "Alta centralizada",
                text: "El usuario debe registrarse desde el portal. Después podrás asignarle aquí el rol correspondiente."
            });
        },

        editar(usuario) {
            $("usuarioSistemaId").value = usuario.id;
            $("usuarioSistemaNombre").value = usuario.nombre;
            $("usuarioSistemaLogin").value = usuario.login;
            $("usuarioSistemaRol").value = usuario.rol;
            $("usuarioSistemaClave").value = "";
            $("usuarioSistemaClave").required = false;
            $("usuarioSistemaClave").disabled = true;
            $("usuarioSistemaActivo").checked = usuario.activo;
            $("ayudaClaveUsuario").textContent = "(se administra desde el acceso central)";
            this.modal.show();
        },

        async guardar(event) {
            event.preventDefault();
            const id = $("usuarioSistemaId").value;
            const anterior = Auth.usuarios().find(item => item.id === id);
            if (!anterior) return;
            if (anterior.id === Auth.usuario.id && !$("usuarioSistemaActivo").checked) {
                return Swal.fire("Acción no permitida", "No puedes desactivar tu propia cuenta.", "warning");
            }

            const cambios = {
                full_name: $("usuarioSistemaNombre").value.trim(),
                login: $("usuarioSistemaLogin").value.trim().toLowerCase(),
                role: $("usuarioSistemaRol").value,
                active: $("usuarioSistemaActivo").checked
            };
            const { error } = await client().from("profiles").update(cambios).eq("id", id);
            if (error) return Swal.fire("No se pudo guardar", error.message, "error");

            await Auth.refrescarUsuarios();
            this.modal.hide();
            this.renderizar();
            Swal.fire({ icon: "success", title: "Usuario actualizado", timer: 1500, showConfirmButton: false });
        },

        renderizar() {
            const items = Auth.usuarios();
            $("tablaUsuarios").innerHTML = items.map(usuario => `<tr><td><strong>${esc(usuario.login)}</strong></td><td>${esc(usuario.nombre)}</td><td><span class="user-role">${esc(Auth.nombreRol(usuario.rol))}</span></td><td><span class="user-state ${usuario.activo ? "active" : "inactive"}">${usuario.activo ? "Activo" : "Inactivo"}</span></td><td>${usuario.ultimoAcceso ? new Date(usuario.ultimoAcceso).toLocaleString("es-MX") : "Sin acceso"}</td><td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${usuario.id}" aria-label="Editar usuario ${esc(usuario.login)}" title="Editar usuario"><i class="fa-solid fa-pen"></i></button><button class="btn btn-sm btn-outline-primary ms-1" data-action="reset" data-id="${usuario.id}" aria-label="Restablecer contraseña de ${esc(usuario.login)}" title="Enviar restablecimiento de contraseña"><i class="fa-solid fa-key"></i></button>${usuario.id !== Auth.usuario.id ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="delete" data-id="${usuario.id}" aria-label="Desactivar usuario ${esc(usuario.login)}" title="Desactivar usuario"><i class="fa-solid fa-user-slash"></i></button>` : ""}</td></tr>`).join("");
            $("usuariosVacio").hidden = items.length > 0;
        },

        async restablecer(usuario) {
            const confirmacion = await Swal.fire({
                icon: "question",
                title: "Restablecer contraseña",
                html: `Se enviará un enlace seguro a <b>${esc(usuario.correo)}</b>.`,
                showCancelButton: true,
                confirmButtonText: "Enviar enlace",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#d7192d"
            });
            if (!confirmacion.isConfirmed) return;

            const redirectTo = `${location.origin}${location.pathname}?version=5.2.0`;
            const { error } = await client().auth.resetPasswordForEmail(usuario.correo, { redirectTo });
            if (error) return Swal.fire("No se pudo enviar", error.message, "error");
            Swal.fire("Enlace enviado", `El usuario debe revisar ${usuario.correo}.`, "success");
        },

        desactivar(usuario) {
            Swal.fire({
                icon: "warning",
                title: `¿Desactivar ${usuario.login}?`,
                showCancelButton: true,
                confirmButtonText: "Desactivar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#d7192d"
            }).then(async resultado => {
                if (!resultado.isConfirmed) return;
                const { error } = await client().from("profiles").update({ active: false }).eq("id", usuario.id);
                if (error) return Swal.fire("No se pudo desactivar", error.message, "error");
                await Auth.refrescarUsuarios();
                this.renderizar();
            });
        }
    };
})(window);
