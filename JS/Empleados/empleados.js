(function (global) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const value = (id) => $(id) ? $(id).value : "";
  const text = (id, content) => { if ($(id)) $(id).textContent = content; };

  const Empleados = {
    modal: null,
    foto: "",
    iniciar() {
      if (!$("tablaEmpleados")) return;
      this.modal = global.bootstrap ? global.bootstrap.Modal.getOrCreateInstance($("modalEmpleado")) : null;
      this.eventos();
      this.actualizar();
    },
    eventos() {
      $("btnNuevoEmpleado").onclick = () => this.nuevo();
      $("formEmpleado").onsubmit = (event) => this.guardar(event);
      $("buscarEmpleado").oninput = () => this.renderizar();
      $("filtroDepartamento").onchange = () => this.renderizar();
      $("filtroEstatus").onchange = () => this.renderizar();
      $("btnExportarEmpleados").onclick = () => this.exportarExcel();
      $("btnLimpiarFiltros").onclick = () => {
        ["buscarEmpleado", "filtroDepartamento", "filtroEstatus"].forEach((id) => { $(id).value = ""; });
        this.renderizar();
      };
      $("fotoEmpleado").onchange = (event) => this.cargarFoto(event);
      $("btnQuitarFoto").onclick = () => { this.foto = ""; this.mostrarFoto(); };
      $("tablaEmpleados").onclick = (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        if (button.dataset.action === "edit") this.editar(button.dataset.id);
        else this.confirmarEliminar(button.dataset.id);
      };
    },
    nuevo() {
      $("formEmpleado").reset();
      $("formEmpleado").classList.remove("was-validated");
      $("empleadoId").value = "";
      this.foto = "";
      text("tituloModalEmpleado", "Nuevo empleado");
      this.mostrarFoto();
      if (this.modal) this.modal.show();
    },
    editar(id) {
      const item = global.EmpleadosCRUD.obtener(id);
      if (!item) return this.aviso("error", "Registro no encontrado");
      const fields = { empleadoId:"id", numeroEmpleado:"numeroEmpleado", nombresEmpleado:"nombres", apellidosEmpleado:"apellidos", empresaEmpleado:"empresa", departamentoEmpleado:"departamento", puestoEmpleado:"puesto", correoEmpleado:"correo", telefonoEmpleado:"telefono", extensionEmpleado:"extension", ubicacionEmpleado:"ubicacion", estatusEmpleado:"estatus", fechaIngresoEmpleado:"fechaIngreso", jefeEmpleado:"jefeInmediato", centroCostoEmpleado:"centroCosto" };
      Object.entries(fields).forEach(([field, key]) => { $(field).value = item[key] || ""; });
      this.foto = item.foto || "";
      $("formEmpleado").classList.remove("was-validated");
      text("tituloModalEmpleado", "Editar empleado");
      this.mostrarFoto();
      if (this.modal) this.modal.show();
    },
    guardar(event) {
      event.preventDefault();
      const form = event.currentTarget;
      form.classList.add("was-validated");
      if (!form.checkValidity()) return;
      const editando = Boolean(value("empleadoId"));
      try {
        global.EmpleadosCRUD.guardar({
          id:value("empleadoId"), numeroEmpleado:value("numeroEmpleado"), nombres:value("nombresEmpleado"), apellidos:value("apellidosEmpleado"), empresa:value("empresaEmpleado"), departamento:value("departamentoEmpleado"), puesto:value("puestoEmpleado"), correo:value("correoEmpleado"), telefono:value("telefonoEmpleado"), extension:value("extensionEmpleado"), ubicacion:value("ubicacionEmpleado"), estatus:value("estatusEmpleado"), fechaIngreso:value("fechaIngresoEmpleado"), jefeInmediato:value("jefeEmpleado"), centroCosto:value("centroCostoEmpleado"), foto:this.foto
        });
        if (this.modal) this.modal.hide();
        this.actualizar();
        this.aviso("success", editando ? "Empleado actualizado" : "Empleado registrado");
      } catch (error) { this.aviso("error", error.message); }
    },
    async confirmarEliminar(id) {
      const item = global.EmpleadosCRUD.obtener(id);
      if (!item) return;
      let confirmed;
      if (global.Swal) {
        const result = await global.Swal.fire({ title:"¿Eliminar empleado?", text:item.nombres + " " + item.apellidos, icon:"warning", showCancelButton:true, confirmButtonText:"Sí, eliminar", cancelButtonText:"Cancelar", confirmButtonColor:"#dc3545" });
        confirmed = result.isConfirmed;
      } else confirmed = global.confirm("¿Eliminar a " + item.nombres + " " + item.apellidos + "?");
      if (confirmed) { global.EmpleadosCRUD.eliminar(id); this.actualizar(); this.aviso("success", "Empleado eliminado"); }
    },
    actualizar() { this.departamentos(); this.renderizar(); this.estadisticas(); },
    departamentos() {
      const selected = value("filtroDepartamento");
      const select = $("filtroDepartamento");
      const options = [...new Set(global.EmpleadosCRUD.listar().map((item) => item.departamento).filter(Boolean))].sort((a,b) => a.localeCompare(b,"es"));
      select.replaceChildren(new Option("Todos los departamentos", ""));
      options.forEach((item) => select.add(new Option(item, item)));
      select.value = selected;
    },
    filtrar() {
      const query = value("buscarEmpleado").trim().toLocaleLowerCase("es-MX");
      const dept = value("filtroDepartamento");
      const status = value("filtroEstatus");
      return global.EmpleadosCRUD.listar().filter((item) => {
        const data = [item.numeroEmpleado,item.nombres,item.apellidos,item.correo,item.puesto,item.empresa,item.ubicacion].join(" ").toLocaleLowerCase("es-MX");
        return (!query || data.includes(query)) && (!dept || item.departamento === dept) && (!status || item.estatus === status);
      }).sort((a,b) => (a.apellidos + a.nombres).localeCompare(b.apellidos + b.nombres,"es"));
    },
    renderizar() {
      const body = $("tablaEmpleados").querySelector("tbody");
      const items = this.filtrar();
      body.replaceChildren();
      items.forEach((item) => body.appendChild(this.fila(item)));
      $("empleadosVacio").hidden = items.length > 0;
      $("tablaEmpleados").hidden = items.length === 0;
      text("conteoEmpleados", items.length + (items.length === 1 ? " empleado" : " empleados"));
    },
    fila(item) {
      const row = document.createElement("tr");
      const fullName = [item.nombres,item.apellidos].filter(Boolean).join(" ");
      const person = document.createElement("td");
      const wrap = document.createElement("div"); wrap.className = "employee-person";
      const avatar = document.createElement("span"); avatar.className = "employee-avatar";
      if (item.foto) { const img=document.createElement("img"); img.src=item.foto; img.alt=""; avatar.appendChild(img); }
      else avatar.textContent = ((item.nombres || "?")[0] + (item.apellidos || "")[0]).toUpperCase();
      const label=document.createElement("span"), strong=document.createElement("strong"), company=document.createElement("small");
      strong.textContent=fullName; company.textContent=item.empresa || "Sin empresa"; label.append(strong,company); wrap.append(avatar,label); person.appendChild(wrap); row.appendChild(person);
      [item.numeroEmpleado,item.departamento,item.puesto].forEach((content) => { const cell=document.createElement("td"); cell.textContent=content || "—"; row.appendChild(cell); });
      const contact=document.createElement("td"), email=document.createElement("span"), phone=document.createElement("small"); contact.className="contact-cell"; email.textContent=item.correo || "—"; phone.textContent=[item.telefono,item.extension ? "Ext. " + item.extension : ""].filter(Boolean).join(" · "); contact.append(email,phone); row.appendChild(contact);
      const status=document.createElement("td"), pill=document.createElement("span"); pill.className="status-pill " + (item.estatus === "Activo" ? "active" : "inactive"); pill.textContent=item.estatus; status.appendChild(pill); row.appendChild(status);
      const actions=document.createElement("td"); actions.className="text-end employee-actions";
      [["edit","Editar","fa-pen","btn-outline-primary"],["delete","Eliminar","fa-trash","btn-outline-danger"]].forEach(([action,title,icon,style]) => { const button=document.createElement("button"), i=document.createElement("i"); button.type="button"; button.className="btn btn-sm " + style + " ms-1"; button.dataset.action=action; button.dataset.id=item.id; button.title=title; button.setAttribute("aria-label",title + " " + fullName); i.className="fa-solid " + icon; button.appendChild(i); actions.appendChild(button); });
      row.appendChild(actions);
      return row;
    },
    estadisticas() {
      const items=global.EmpleadosCRUD.listar();
      text("statTotal",items.length); text("statActivos",items.filter(e=>e.estatus==="Activo").length); text("statInactivos",items.filter(e=>e.estatus==="Inactivo").length); text("statDepartamentos",new Set(items.map(e=>e.departamento).filter(Boolean)).size);
    },
    cargarFoto(event) {
      const file=event.target.files[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 1024*1024) { event.target.value=""; return this.aviso("error","Selecciona una imagen JPG, PNG o WebP de máximo 1 MB."); }
      const reader=new FileReader(); reader.onload=()=>{this.foto=reader.result;this.mostrarFoto();}; reader.onerror=()=>this.aviso("error","No se pudo leer la fotografía."); reader.readAsDataURL(file);
    },
    mostrarFoto() {
      const preview=$("fotoPreview"); preview.replaceChildren();
      if(this.foto){const img=document.createElement("img");img.src=this.foto;img.alt="Vista previa";preview.appendChild(img);}
      else{const icon=document.createElement("i");icon.className="fa-solid fa-user";preview.appendChild(icon);}
    },
    exportarExcel() {
      const items=this.filtrar();
      if(!items.length)return this.aviso("info","No hay empleados para exportar.");
      if(!global.XLSX)return this.aviso("error","No se pudo cargar el componente de Excel. Verifica tu conexión.");
      const rows=items.map((e)=>({"Número de empleado":e.numeroEmpleado,"Nombre(s)":e.nombres,"Apellidos":e.apellidos,"Empresa":e.empresa,"Departamento":e.departamento,"Puesto":e.puesto,"Correo":e.correo,"Teléfono":e.telefono,"Extensión":e.extension,"Ubicación":e.ubicacion,"Estatus":e.estatus,"Fecha de ingreso":e.fechaIngreso,"Jefe inmediato":e.jefeInmediato,"Centro de costo":e.centroCosto}));
      const sheet=global.XLSX.utils.json_to_sheet(rows); sheet["!cols"]=[18,20,24,20,20,24,28,16,12,20,12,16,24,18].map((wch)=>({wch}));
      const book=global.XLSX.utils.book_new(); global.XLSX.utils.book_append_sheet(book,sheet,"Empleados"); global.XLSX.writeFile(book,"Empleados_"+new Date().toISOString().slice(0,10)+".xlsx"); this.aviso("success","Archivo de empleados exportado");
    },
    aviso(icon,message) { if(global.Swal)global.Swal.fire({icon,title:message,timer:icon==="success"?1600:undefined,showConfirmButton:icon!=="success"});else global.alert(message); }
  };
  global.Empleados=Empleados;
})(window);
