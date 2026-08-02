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
                boton.dataset.action === "edit" ? this.editar(usuario) : this.desactivar(usuario);
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
            $("tablaUsuarios").innerHTML = items.map(usuario => `<tr><td><strong>${esc(usuario.login)}</strong></td><td>${esc(usuario.nombre)}</td><td><span class="user-role">${esc(Auth.nombreRol(usuario.rol))}</span></td><td><span class="user-state ${usuario.activo ? "active" : "inactive"}">${usuario.activo ? "Activo" : "Inactivo"}</span></td><td>${usuario.ultimoAcceso ? new Date(usuario.ultimoAcceso).toLocaleString("es-MX") : "Sin acceso"}</td><td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${usuario.id}" aria-label="Editar usuario ${esc(usuario.login)}"><i class="fa-solid fa-pen"></i></button>${usuario.id !== Auth.usuario.id ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="delete" data-id="${usuario.id}" aria-label="Desactivar usuario ${esc(usuario.login)}"><i class="fa-solid fa-user-slash"></i></button>` : ""}</td></tr>`).join("");
            $("usuariosVacio").hidden = items.length > 0;
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
