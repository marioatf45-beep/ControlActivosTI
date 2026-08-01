(function(global){"use strict";
const fecha=valor=>{if(!valor)return"";return new Intl.DateTimeFormat("es-MX",{dateStyle:"long",timeZone:"UTC"}).format(new Date(valor+"T12:00:00Z"));};
global.CartaResponsiva={
 generar(registro){
  if(!global.jspdf?.jsPDF)throw new Error("No se pudo cargar el generador de PDF.");
  const doc=new global.jspdf.jsPDF({unit:"mm",format:"letter"}),azul=[23,53,92],margen=18,ancho=180;
  doc.setFillColor(...azul);doc.rect(0,0,216,26,"F");doc.setTextColor(255);doc.setFont("helvetica","bold");doc.setFontSize(17);doc.text("CARTA RESPONSIVA DE EQUIPO DE TI",108,12,{align:"center"});doc.setFontSize(9);doc.text(`Folio: ${registro.folio}`,108,19,{align:"center"});
  doc.setTextColor(35);doc.setFontSize(10);doc.setFont("helvetica","normal");let y=35;
  const esUnidad=registro.tipoDestino==="UnidadTR",destino=registro.destino||registro.empleado,empresa=destino.empresa||"La empresa";const intro=esUnidad?`Por medio de la presente, ${destino.operador||"el operador responsable"} declara recibir la tablet descrita a continuación para uso exclusivo en la unidad ${destino.clave}, placas ${destino.placas||"N/A"}, el ${fecha(registro.fechaAsignacion)}.`:`Por medio de la presente, ${destino.nombre}, con número de empleado ${destino.numeroEmpleado||"N/A"}, adscrito(a) al departamento ${destino.departamento||"N/A"}, declara recibir de ${empresa} los equipos descritos a continuación el ${fecha(registro.fechaAsignacion)}.`;
  const lineas=doc.splitTextToSize(intro,ancho);doc.text(lineas,margen,y);y+=lineas.length*5+5;
  doc.setFont("helvetica","bold");doc.text("EQUIPOS ENTREGADOS",margen,y);y+=6;doc.setFontSize(8);
  registro.activos.forEach((a,i)=>{doc.setFillColor(i%2?248:238,243,250);doc.rect(margen,y-4,ancho,8,"F");doc.setTextColor(35);doc.text(`${i+1}. Activo: ${a.activo||"N/A"}   Serie: ${a.serie||"N/A"}   ${a.marca||""} ${a.modelo||""}`,margen+2,y+1);y+=9;});
  y+=3;doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text("CONDICIONES DE RESPONSABILIDAD",margen,y);y+=6;doc.setFont("helvetica","normal");
  const clausulas=["Utilizar los equipos exclusivamente para actividades laborales autorizadas.","Conservarlos en buen estado y reportar inmediatamente daños, pérdida, robo o fallas.","No prestar, transferir, modificar ni retirar componentes sin autorización del área de TI.","Devolver los equipos y accesorios cuando sean solicitados o al terminar la relación laboral.","Aceptar que la firma digital plasmada en este documento expresa conformidad con la entrega."];
  clausulas.forEach((c,i)=>{const l=doc.splitTextToSize(`${i+1}. ${c}`,ancho-4);doc.text(l,margen+2,y);y+=l.length*4.5+2;});
  if(registro.observaciones){doc.setFont("helvetica","bold");doc.text("OBSERVACIONES",margen,y);y+=5;doc.setFont("helvetica","normal");const obs=doc.splitTextToSize(registro.observaciones,ancho);doc.text(obs,margen,y);y+=obs.length*4.5+4;}
  if(y>220){doc.addPage();y=30;}
  doc.setDrawColor(170);doc.line(25,247,95,247);doc.line(121,247,191,247);
  if(registro.firmaEmpleado)doc.addImage(registro.firmaEmpleado,"PNG",38,221,44,23);
  doc.setFontSize(9);doc.setFont("helvetica","bold");doc.text(esUnidad?(destino.operador||destino.nombre):destino.nombre,60,252,{align:"center"});doc.text(registro.entregaPor,156,252,{align:"center"});doc.setFont("helvetica","normal");doc.text(esUnidad?`Operador responsable · ${destino.clave}`:"Empleado responsable - Firma digital",60,257,{align:"center"});doc.text("Entrega por - Firma",156,257,{align:"center"});
  doc.setFontSize(7);doc.setTextColor(100);doc.text(`Documento generado el ${new Date().toLocaleString("es-MX")} | ID ${registro.id}`,108,272,{align:"center"});
  doc.save(`Carta_Responsiva_${registro.folio}.pdf`);
 }
};})(window);
