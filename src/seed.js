/* Estructura inicial de la organización.

   Es la misma que estaba escrita a mano dentro de organigrama.html; acá vive una
   sola vez y sirve para poblar la base la primera vez que arranca el servidor
   (y para POST /api/reset).

   Nota sobre geometría: los ángulos (a0/a1/angle) ya NO se declaran acá. El visor
   los reparte solo según cuántos hermanos haya, así que agregar un departamento o
   una sucursal reacomoda la corona sin tocar código. */

const C = {
  gold: '#e0b83a', orange: '#f08a3c', green: '#5fa85f', teal: '#2a9d9d',
  blue: '#5b8fc7', navy: '#2c5d8f', suc: '#1e4a7d',
};

const HALVES = [
  { id: 'fch', label: 'FINANCIERA\nCONTABLE\nHUMANA', color: '#123a5f', kind: 'half', children: [
    { id: 'contabilidad', label: 'ADMINISTRACION\nCONTABLE', color: C.blue, kind: 'wedge', children: [
      { id: 'con1', label: 'Gerencia\nAdministrativa\nContable', color: C.blue, headcount: 1 },
      { id: 'con2', label: 'Contador', color: C.blue, headcount: 1 },
      { id: 'con3', label: 'Encargada de\nTesoreria', color: C.blue, headcount: 1 },
      { id: 'con4', label: 'Asistente\nAdministrativo\nContable', color: C.blue, headcount: 1 },
    ] },
    { id: 'rrhh', label: 'RECURSOS\nHUMANOS', color: C.navy, kind: 'wedge', children: [
      { id: 'rh1', label: 'Jefatura\nde RRHH', color: C.navy, headcount: 1 },
      { id: 'rh2', label: 'Generalista de\nRRHH', color: C.navy, headcount: 1 },
      { id: 'rh3', label: 'Asistente de\n RRHH', color: C.navy, headcount: 1 },
      { id: 'rh4', label: 'Salud\nOcupacional', color: C.navy, headcount: 1 },
    ] },
  ] },
  { id: 'co', label: 'COMERCIAL\nOPERATIVA', color: '#1d5687', kind: 'half', children: [
    { id: 'importaciones', label: 'IMPORTACIONES', color: C.gold, kind: 'wedge', children: [
      { id: 'imp1', label: 'Jefatura de\nImportaciones', color: C.gold, headcount: 1, children: [
        { id: 'imp1-aux', label: 'Asistente de\nImportaciones', color: C.gold, headcount: 1 },
      ] },
      { id: 'imp2', label: 'Encargado de\nImportaciones', color: C.gold, headcount: 1, children: [
        { id: 'imp2-aux', label: 'Asistente de\nImportaciones', color: C.gold, headcount: 1 },
      ] },
      { id: 'imp3', label: 'Encargado de \nInventarios', color: C.gold, headcount: 1, children: [
        { id: 'imp3-aux', label: 'Asistente de\nInventarios', color: C.gold, headcount: 1 },
        { id: 'imp3-aux2', label: 'Bodeguero\nMontacarguista', color: C.gold, headcount: 1 },
      ] },
    ] },
    { id: 'ventas', label: 'VENTAS', color: C.orange, kind: 'wedge', children: [
      { id: 'ven1', label: 'Jefatura de\n ventas', color: C.orange, headcount: 1 },
    ] },
    { id: 'operaciones', label: 'OPERACIONES Y\n LOGISTICA', color: C.green, kind: 'wedge', children: [
      { id: 'ope1', label: 'Jefatura de\nOperaciones', color: C.green, headcount: 1 },
      { id: 'ope2', label: 'Jefatura de\nTransporte', color: C.green, headcount: 1 },
      { id: 'ope3', label: 'Jefatura de\nMantenimiento', color: C.green, headcount: 1 },
      { id: 'ope4', label: 'Bodega', color: C.green, headcount: 1 },
    ] },
    { id: 'servgen', label: 'PROVEEDURIA Y\n SERVICIOS\nGENERALES', color: C.teal, kind: 'wedge', children: [
      { id: 'sg1', label: 'Jefatura de\nProveeduria y\nServicios Generales', color: C.teal, headcount: 1 },
      { id: 'sg2', label: 'TI', color: C.teal, headcount: 1 },
      { id: 'sg3', label: 'Asistente\nAdministrativo', color: C.teal, headcount: 1 },
    ] },
  ] },
];

const SUCS = [
  { id: 'lindora', label: 'LINDORA', sub: 'Administrador', color: C.suc, kind: 'suc', children: [
    { id: 'lin-bod', label: 'BODEGA', color: C.green, children: [
      { id: 'linb1', label: 'Supervisor de \nBodega', color: C.green, headcount: 1 },
      { id: 'linb2', label: 'Asistente de\nDespacho', color: C.green, headcount: 1 },
      { id: 'linb3', label: 'Bodeguero\nMontacarguista', color: C.green, headcount: 1 },
    ] },
    { id: 'lin-tra', label: 'TRANSPORTE', color: C.green, children: [
      { id: 'lint1', label: 'Chofer', color: C.green, headcount: 1 },
    ] },
    { id: 'lin-ven', label: 'VENTAS', color: C.orange, children: [
      { id: 'linv1', label: 'Supervisor\nde Ventas', color: C.orange, headcount: 1 },
      { id: 'linv2', label: 'Display', color: C.orange, headcount: 1 },
      { id: 'linv3', label: 'Recepcionista', color: C.orange, headcount: 1 },
      { id: 'linv4', label: 'Asesores\nde Ventas', color: C.orange, headcount: 1 },
    ] },
    { id: 'lin-sg', label: 'SERVICIOS\nGENERALES', color: C.teal, children: [
      { id: 'lins1', label: 'Cafetería', color: C.teal, headcount: 1 },
      { id: 'lins2', label: 'Misceláneos', color: C.teal, headcount: 1 },
      { id: 'lins3', label: 'Seguridad', color: C.teal, headcount: 1 },
    ] },
    { id: 'lin-con', label: 'CONTABLE', color: C.blue, children: [
      { id: 'linc1', label: 'Asistente\nAdministrativo', color: C.blue, headcount: 1 },
      { id: 'linc2', label: 'Cajas', color: C.blue, headcount: 1 },
    ] },
  ] },
  { id: 'coyol', label: 'COYOL', sub: 'Administrador', color: C.suc, kind: 'suc', children: [
    { id: 'coy-bod', label: 'BODEGA', color: C.green, children: [
      { id: 'coyb1', label: 'Bodeguero\nMontacarguista', color: C.green, headcount: 1 },
      { id: 'coyb2', label: 'Asistente de\nDespacho', color: C.green, headcount: 1 },
      { id: 'coyb3', label: 'Supervisor de\nBodega', color: C.green, headcount: 1 },
      { id: 'coyb4', label: 'Ayudante\nde Bodega', color: C.green, headcount: 1 },
    ] },
    { id: 'coy-tra', label: 'TRANSPORTE', color: C.green, children: [
      { id: 'coyt1', label: 'Chofer', color: C.green, headcount: 1 },
    ] },
    { id: 'coy-ven', label: 'VENTAS', color: C.orange, children: [
      { id: 'coyv1', label: 'Supervisor\nde Ventas', color: C.orange, headcount: 1 },
      { id: 'coyv2', label: 'Display', color: C.orange, headcount: 1 },
      { id: 'coyv3', label: 'Recepcionista', color: C.orange, headcount: 1 },
      { id: 'coyv4', label: 'Asesores\nde Ventas', color: C.orange, headcount: 1 },
    ] },
    { id: 'coy-sg', label: 'SERVICIOS\nGENERALES y\n PROVEEDURIA', color: C.teal, children: [
      { id: 'coys1', label: 'Seguridad', color: C.teal, headcount: 1 },
      { id: 'coys2', label: 'Misceláneos', color: C.teal, headcount: 1 },
    ] },
    { id: 'coy-con', label: 'CONTABLE', color: C.blue, children: [
      { id: 'coyc1', label: 'Asistente\nAdministrativo', color: C.blue, headcount: 1 },
      { id: 'coyc2', label: 'Cajas', color: C.blue, headcount: 1 },
    ] },
  ] },
  { id: 'curridabat', label: 'CURRIDABAT', sub: 'Administrador', color: C.suc, kind: 'suc', children: [
    { id: 'cur-bod', label: 'BODEGA', color: C.green, children: [
      { id: 'curb1', label: 'Supervisor de \nBodega', color: C.green, headcount: 1 },
      { id: 'curb2', label: 'Asistente de\nDespacho', color: C.green, headcount: 1 },
      { id: 'curb3', label: 'Bodeguero\nMontacarguista', color: C.green, headcount: 1 },
      { id: 'curb4', label: 'Ayudante\nde Bodega', color: C.green, headcount: 1 },
    ] },
    { id: 'cur-tra', label: 'TRANSPORTE', color: C.green, children: [
      { id: 'curt1', label: 'Chofer', color: C.green, headcount: 1 },
    ] },
    { id: 'cur-ven', label: 'VENTAS', color: C.orange, children: [
      { id: 'curv1', label: 'Supervisor\nde Ventas', color: C.orange, headcount: 1 },
      { id: 'curv2', label: 'Display', color: C.orange, headcount: 1 },
      { id: 'curv3', label: 'Recepcionista', color: C.orange, headcount: 1 },
      { id: 'curv4', label: 'Asesores\nde Ventas', color: C.orange, headcount: 1 },
    ] },
    { id: 'cur-sg', label: 'SERVICIOS\nGENERALES', color: C.teal, children: [
      { id: 'curs1', label: 'Seguridad', color: C.teal, headcount: 1 },
      { id: 'curs2', label: 'Cafetería', color: C.teal, headcount: 1 },
      { id: 'curs3', label: 'Misceláneos', color: C.teal, headcount: 1 },
    ] },
    { id: 'cur-con', label: 'CONTABLE', color: C.blue, children: [
      { id: 'curc1', label: 'Asistente\nAdministrativo', color: C.blue, headcount: 1 },
      { id: 'curc2', label: 'Cajas', color: C.blue, headcount: 1 },
    ] },
  ] },
  { id: 'huacas', label: 'HUACAS', sub: 'Administrador', color: C.suc, kind: 'suc', children: [
    { id: 'hua-bod', label: 'BODEGA', color: C.green, children: [
      { id: 'huab1', label: 'Bodeguero\nMontacarguista', color: C.green, headcount: 1 },
      { id: 'huab2', label: 'Ayudante\nde Bodega', color: C.green, headcount: 1 },
    ] },
    { id: 'hua-ven', label: 'VENTAS', color: C.orange, children: [
      { id: 'huav1', label: 'Supervisor\nde Ventas', color: C.orange, headcount: 1 },
      { id: 'huav2', label: 'Asesores\nde Ventas', color: C.orange, headcount: 1 },
    ] },
    { id: 'hua-con', label: 'CONTABLE', color: C.blue, children: [
      { id: 'huac1', label: 'Asistente\nAdministrativo', color: C.blue, headcount: 1 },
    ] },
  ] },
];

const SEED_TREE = {
  id: 'center', label: 'CASA MATRIZ', color: '#0f2947', kind: 'core',
  children: [...HALVES, ...SUCS],
};

module.exports = { SEED_TREE, PALETTE: C };
