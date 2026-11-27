'use client';

/*
 * «Saber más» de cada indicador, gráfico y tabla del cuadro financiero.
 * Cada ficha explica qué es, cómo se calcula (y de dónde sale en Odoo), cómo leerlo y qué tener en cuenta.
 * En los textos, las líneas que empiezan por «• » se muestran como lista.
 */
import { useEffect, useState } from 'react';

interface Ficha { t: string; que: string; calc: string; leer: string; ojo?: string }

const PGC_NOTA = 'Las cuentas se reconocen por cómo empieza su código del Plan General Contable (gana el prefijo más largo: la 407 va a anticipos aunque empiece por 40).';

export const INFO: Record<string, Ficha> = {
  /* ================= Contabilidad y deuda ================= */
  teso_total: {
    t: 'Tesorería total',
    que: 'El dinero que las compañías elegidas tienen hoy en bancos, caja, tarjetas y cuentas de cartera de inversión, según la contabilidad.',
    calc: 'Suma del saldo contable de todos los diarios de tipo Banco o Efectivo de Odoo. El saldo de cada diario es la suma (debe − haber) de los apuntes publicados en su cuenta contable por defecto (normalmente una 572) con fecha igual o anterior a hoy.\n• Líquido: diarios normales.\n• En cartera: diarios cuyo nombre contiene «cartera» (instrumentos financieros).',
    leer: 'La barra muestra qué parte es líquida (verde azulado) y qué parte está en cartera (violeta). La cartera cuenta como tesorería pero no está disponible al instante para pagar.',
    ojo: 'Es el saldo contable, no el del banco: si hay movimientos del extracto sin conciliar o sin registrar, puede diferir de lo que ves en la banca online (compáralo en Bancos). Las tarjetas de crédito con saldo negativo restan. Pulsa la cifra para ver los apuntes.',
  },
  pend_cobro: {
    t: 'Pendiente de cobro',
    que: 'Lo que los clientes deben a las compañías elegidas: facturas emitidas y publicadas que aún no se han cobrado del todo.',
    calc: 'Suma del importe pendiente de los apuntes publicados en cuentas «Por cobrar» (normalmente 430) que no están conciliados.\n• Atrasado: apuntes cuyo vencimiento es anterior a hoy (si no tienen vencimiento, se usa su fecha).\n• Nº de facturas: número de asientos distintos con importe pendiente.',
    leer: 'La barra separa lo que está al día (verde) de lo atrasado (rojo). Un porcentaje atrasado alto indica problemas de cobro: revisa la morosidad y el periodo medio de cobro.',
    ojo: 'Los abonos y anticipos de clientes no aplicados restan. Si un cobro se ha registrado pero no se ha conciliado con su factura, la factura sigue apareciendo como pendiente. Pulsa la cifra (o «atrasado») para ver los apuntes.',
  },
  pend_pago: {
    t: 'Pendiente de pago',
    que: 'Lo que las compañías elegidas deben a sus proveedores y acreedores: facturas recibidas y publicadas que aún no se han pagado del todo.',
    calc: 'Suma del importe pendiente de los apuntes publicados en cuentas «Por pagar» (normalmente 400 y 410) no conciliados, en positivo.\n• Atrasado: vencimiento anterior a hoy.\n• Nº de facturas: asientos distintos con importe pendiente.',
    leer: 'La barra separa lo que está al día (coral) de lo atrasado (ámbar). Mucho importe atrasado puede suponer recargos o tensión con proveedores.',
    ojo: 'Las facturas de proveedor en borrador (pendientes de validar) no cuentan hasta que se publican: se avisan en el gráfico de deuda. Los pagos registrados sin conciliar dejan la factura como pendiente.',
  },
  pos_neta: {
    t: 'Posición neta',
    que: 'Lo que quedaría si hoy se cobrase todo lo pendiente de clientes y se pagase todo lo pendiente a proveedores.',
    calc: 'Tesorería total + pendiente de cobro − pendiente de pago.',
    leer: 'Positiva: el dinero y los cobros pendientes cubren la deuda comercial. Negativa: aunque se cobrara todo, no llegaría para pagar a proveedores.',
    ojo: 'Solo tiene en cuenta clientes y proveedores: no incluye préstamos, impuestos, nóminas ni otras deudas. Supone que se cobra todo, incluido lo atrasado.',
  },
  g_cobertura: {
    t: 'Cobertura de proveedores',
    que: 'Cuántas veces podrías pagar toda la deuda con proveedores usando el dinero en banco más lo que te deben los clientes.',
    calc: '(Tesorería total + pendiente de cobro) / pendiente de pago.',
    leer: '• Verde (correcto): 1,5 o más.\n• Ámbar (vigilar): entre 1 y 1,5.\n• Rojo (riesgo): menos de 1, ni cobrándolo todo se cubre la deuda comercial.',
    ojo: 'Es optimista: da por cobrado lo atrasado. Compáralo con la disponibilidad, que solo usa dinero líquido.',
  },
  g_disponibilidad: {
    t: 'Disponibilidad',
    que: 'Qué parte de la deuda con proveedores podrías pagar hoy mismo con el dinero líquido, sin esperar ningún cobro.',
    calc: 'Tesorería líquida (sin cuentas de cartera) / pendiente de pago.',
    leer: '• Verde: 0,6 o más (pagas al menos el 60 % con lo que tienes).\n• Ámbar: entre 0,3 y 0,6.\n• Rojo: menos de 0,3.',
    ojo: 'Un valor bajo no es grave si los cobros entran con regularidad; mira también los meses de cobertura y la previsión de tesorería.',
  },
  g_meses: {
    t: 'Meses de cobertura',
    que: 'Cuántos meses podrías seguir pagando con el dinero líquido actual si no entrara ningún cobro.',
    calc: 'Tesorería líquida / salida media mensual.\nSalida media mensual = pagos a proveedores de los últimos 12 meses / 12 + salida mensual de los ajustes de periodo (asientos recurrentes que sacan dinero del banco; los trimestrales se dividen entre 3 y los anuales entre 12).',
    leer: '• Verde: 2 meses o más.\n• Ámbar: entre 1 y 2.\n• Rojo: menos de 1 mes.',
    ojo: 'Solo cuenta las salidas registradas como pagos a proveedores o como asientos recurrentes. Si nóminas, impuestos o préstamos se registran de otra forma, la salida real es mayor y los meses, menos.',
  },
  g_morosidad: {
    t: 'Morosidad de clientes',
    que: 'Qué porcentaje de lo que te deben los clientes ya ha vencido.',
    calc: 'Pendiente de cobro atrasado / pendiente de cobro total × 100.',
    leer: '• Verde: 10 % o menos.\n• Ámbar: entre el 10 y el 25 %.\n• Rojo: más del 25 %.',
    ojo: 'Un vencimiento mal puesto en la factura (o sin vencimiento) cambia el resultado. Revisa los clientes con más deuda vencida pulsando «atrasado» en Pendiente de cobro.',
  },
  g_pmc: {
    t: 'Periodo medio de cobro',
    que: 'Cuántos días tardas de media en cobrar a tus clientes.',
    calc: 'Pendiente de cobro / cobros de clientes de los últimos 12 meses × 365.\nLos cobros son los pagos de Odoo de tipo «Recibir» de clientes, publicados, sin traspasos internos.',
    leer: '• Verde: 60 días o menos.\n• Ámbar: entre 60 y 90 días.\n• Rojo: más de 90 días.',
    ojo: 'Si los cobros no se registran como pagos en Odoo (por ejemplo, conciliando directamente el extracto contra la factura), el denominador baja y el plazo sale más alto de lo real.',
  },
  g_pmp: {
    t: 'Periodo medio de pago',
    que: 'Cuántos días tardas de media en pagar a tus proveedores.',
    calc: 'Pendiente de pago / pagos a proveedores de los últimos 12 meses × 365.',
    leer: '• Verde: 60 días o menos (límite legal de la Ley 15/2010).\n• Ámbar: entre 60 y 75 días.\n• Rojo: más de 75 días.',
    ojo: 'Igual que en el cobro: si los pagos no se registran como pagos de Odoo, el resultado se desvía.',
  },
  c_deuda: {
    t: 'Deuda de clientes y con proveedores',
    que: 'El pendiente de cobro y de pago de cada compañía, separando lo que está al día de lo atrasado.',
    calc: 'Mismo cálculo que las tarjetas de pendiente de cobro y de pago, por compañía.\n• Verde: clientes al día. Rojo: clientes atrasado.\n• Coral: proveedores al día. Ámbar: proveedores atrasado.\nEtiquetas inferiores:\n• Facturas de proveedor a validar: facturas de proveedor en borrador (número e importe total).\n• Por revisar: facturas marcadas «Por revisar» en Odoo.',
    leer: 'Compara el tamaño de las barras de clientes y proveedores de cada compañía y cuánto rojo o ámbar tienen. Pulsa un tramo para ver sus apuntes.',
    ojo: 'Las facturas en borrador no entran en las barras hasta que se publican.',
  },
  c_teso: {
    t: 'Dónde está la tesorería',
    que: 'Cómo se reparte el dinero entre bancos, caja y carteras.',
    calc: 'Saldo contable de cada diario de banco o efectivo. Se muestran los 7 de mayor saldo positivo y el resto se agrupa en «Otros diarios». El color es el de la entidad (Santander, BBVA, Bankinter, Cajamar…).',
    leer: 'El centro indica el total del gráfico. La leyenda da el saldo de cada diario. Pulsa un sector para ver sus apuntes.',
    ojo: 'Los diarios con saldo negativo (tarjetas) no aparecen en el donut, por eso su total puede ser algo mayor que la tesorería total.',
  },
  c_cobpag: {
    t: 'Cobros y pagos registrados por mes',
    que: 'Lo que ha entrado y salido de verdad cada mes en los últimos 24 meses.',
    calc: '• Barras verdes: cobros de clientes (pagos de Odoo de tipo «Recibir» a clientes, publicados).\n• Barras coral (hacia abajo): pagos a proveedores (tipo «Enviar» a proveedores).\n• Línea: neto del mes (cobros − pagos).\nSe usa la fecha del pago y se excluyen los traspasos internos.',
    leer: 'Meses con la línea por debajo de cero son meses en los que salió más de lo que entró. Pulsa una barra para ver los apuntes de ese mes.',
    ojo: 'No incluye devoluciones a clientes, cobros de proveedores ni movimientos que no se registren como pagos (por ejemplo, nóminas o impuestos pagados desde el extracto).',
  },
  c_topc: {
    t: 'Top 10 clientes',
    que: 'Los 10 clientes que más te han pagado en los últimos 12 meses.',
    calc: 'Suma de los cobros publicados de cada cliente con fecha en los últimos 12 meses.',
    leer: 'Te da la concentración de ingresos: si unos pocos clientes suponen la mayoría de los cobros, dependes mucho de ellos. Pulsa una barra para ver sus cobros.',
  },
  c_topp: {
    t: 'Top 10 proveedores',
    que: 'Los 10 proveedores a los que más has pagado en los últimos 12 meses.',
    calc: 'Suma de los pagos publicados a cada proveedor con fecha en los últimos 12 meses.',
    leer: 'Muestra en qué proveedores se va el dinero. Pulsa una barra para ver sus pagos.',
  },
  c_metc: {
    t: 'Cómo cobramos',
    que: 'Con qué medio cobras a los clientes: transferencia, pagaré, confirming, remesa…',
    calc: 'Cobros de los últimos 12 meses agrupados por el método de pago indicado en cada pago de Odoo.',
    leer: 'Mucho pagaré o confirming implica cobros a plazo y riesgo de impago o coste de anticipo.',
    ojo: 'Depende de que se elija bien el método al registrar cada cobro; «Manual» suele indicar que no se especificó.',
  },
  c_metp: {
    t: 'Cómo pagamos',
    que: 'Con qué medio pagas a los proveedores.',
    calc: 'Pagos de los últimos 12 meses agrupados por el método de pago de cada pago de Odoo.',
    leer: 'Ayuda a ver cuánto se paga con pagarés o confirming (con vencimiento futuro) frente a transferencias inmediatas.',
  },
  c_proy: {
    t: 'Proyectos con más cobros',
    que: 'Las obras o proyectos que más dinero han ingresado en los últimos 12 meses.',
    calc: 'Cobros de clientes de los últimos 12 meses que tienen informado el campo «Proyecto» en el pago, sumados por proyecto (15 primeros). La etiqueta indica la compañía y la barra compara con el primero.',
    leer: 'Útil para ver qué obras sostienen la tesorería.',
    ojo: 'Los cobros sin proyecto asignado no aparecen aquí.',
  },

  /* ================= Previsión de tesorería ================= */
  p_partida: {
    t: 'Saldo de partida',
    que: 'El dinero con el que empieza la previsión, hoy.',
    calc: 'Suma del saldo de los diarios incluidos (respeta el desplegable de diarios y el interruptor de cartera):\n• Partir del saldo contable: apuntes publicados hasta hoy en la cuenta de cada diario.\n• Partir del último estado de cuenta: saldo final del último extracto importado de cada diario (si no tiene extractos, su saldo contable).',
    leer: 'El texto inferior indica cuántos diarios suma y de qué saldo parte. Pulsa la cifra (con saldo contable) para ver sus apuntes.',
  },
  p_final: {
    t: 'Saldo previsto al final',
    que: 'El dinero que habrá el último día del horizonte elegido si se cumplen los movimientos previstos.',
    calc: 'Saldo de partida + todos los cobros, pagos, ajustes de periodo y (si está activa) la estimación hasta la fecha final.',
    leer: 'En rojo si termina en negativo.',
  },
  p_minimo: {
    t: 'Saldo mínimo',
    que: 'El peor momento de la previsión: el día con menos dinero.',
    calc: 'El menor de los saldos diarios previstos y su fecha.',
    leer: 'Es el dato clave para anticiparse: aunque el final sea positivo, un mínimo negativo significa que algún día faltará dinero.',
  },
  p_flujo: {
    t: 'Flujo neto del periodo',
    que: 'Cuánto cambia el dinero entre hoy y el final del horizonte.',
    calc: 'Saldo previsto al final − saldo de partida. Debajo, el número de movimientos previstos considerados (la estimación cuenta un movimiento por día laborable y compañía).',
    leer: 'Negativo: en el periodo sale más dinero del que entra.',
  },
  p_cascada: {
    t: 'De hoy al final del horizonte',
    que: 'Cómo se pasa del saldo de hoy al saldo final, por tipo de movimiento.',
    calc: 'Barras flotantes: Saldo hoy → + cobros programados → − pagos programados → ± ajustes de periodo → ± estimación (si está activa) → Saldo final. Las barras de saldo son verde azulado (rojas si son negativas).',
    leer: 'Cada barra empieza donde terminó la anterior: se ve de un vistazo qué bloque consume más dinero.',
  },
  p_calendario: {
    t: 'Calendario de movimientos',
    que: 'El neto previsto de cada día de los próximos 6 meses, como un calendario.',
    calc: 'Cada columna es una semana y cada fila un día (de lunes a domingo). El color es el neto del día: verde si entra más de lo que sale y coral si sale más. La intensidad es proporcional al mayor movimiento del periodo. Gris: sin movimientos.',
    leer: 'Permite ver los días concentrados (nóminas, impuestos, vencimientos de pagarés). Pasa el ratón por un día para ver sus movimientos.',
  },
  p_saldo_diario: {
    t: 'Saldo previsto de tesorería',
    que: 'La evolución del dinero día a día hasta el final del horizonte.',
    calc: 'Línea escalonada: cada día suma al anterior el neto de sus movimientos. La línea roja discontinua es el cero. Con varias compañías, la línea principal es el grupo y cada compañía tiene una línea discontinua calculada con sus propios diarios y movimientos.',
    leer: 'Si la línea cruza el cero, ese día faltaría dinero. Pasa el ratón para ver el saldo de cada día.',
  },
  p_mes: {
    t: 'Entradas y salidas por mes',
    que: 'Los movimientos previstos agrupados por mes y el saldo con el que termina cada mes.',
    calc: 'Barras apiladas: cobros (verde) y estimación hacia arriba; pagos (coral) y ajustes (ámbar) hacia abajo. La línea, con su eje a la derecha, es el saldo a fin de mes.',
    leer: 'Ayuda a ver qué meses son deficitarios y cómo va bajando o subiendo el saldo.',
  },
  p_resumen: {
    t: 'Resumen mensual',
    que: 'La previsión mes a mes en forma de tabla.',
    calc: 'Para cada mes: saldo inicial, cobros, pagos, ajustes, estimación (si está activa) y saldo final = inicial + movimientos. El primer mes empieza hoy.',
    leer: 'Saldos en rojo: meses que terminan en negativo. Exportable a Excel.',
  },
  p_proximos: {
    t: 'Próximos movimientos',
    que: 'Lo que está previsto que entre o salga en los próximos 30 días.',
    calc: '• Cobro / Pago: pagos de Odoo con fecha posterior a hoy (en borrador o publicados), por ejemplo pagarés o confirming.\n• Ajuste: cuota de un asiento recurrente.\nNo incluye la estimación. La columna Saldo acumula desde el saldo de partida.',
    leer: 'Sirve como agenda de tesorería del próximo mes.',
  },
  p_ajustes: {
    t: 'Ajustes de periodo',
    que: 'Los cargos y abonos que se repiten (nóminas, préstamos, renting, seguros, impuestos…) tal como están configurados en Odoo.',
    calc: 'Son los asientos en borrador con «Contabilizar automáticamente» mensual, trimestral, anual o en una fecha, que mueven una cuenta de banco o caja. Importe: lo que mueven en esas cuentas. Inicio: fecha del primer asiento de la serie. Fin: «Contabilizar hasta». Próximo cargo: fecha del borrador pendiente. Las cuotas se repiten el mismo día del mes hasta la fecha fin (sin fin, hasta 36 meses).',
    leer: 'Ordenados de mayor salida a menor. Revisa que los importes y fechas fin sean los actuales.',
    ojo: 'Un asiento recurrente que no toca bancos (por ejemplo, una factura de alquiler) no aparece aquí: se recoge cuando la factura se publica (en la estimación o al pagarse).',
  },

  /* ================= Bancos ================= */
  b_cmp: {
    t: 'Saldo contable frente a último estado de cuenta',
    que: 'Compara, para cada diario con extractos, lo que dice la contabilidad con lo que dice el banco.',
    calc: '• Barra intensa: saldo contable (apuntes publicados hasta hoy en la cuenta del diario).\n• Barra clara: saldo final del último extracto importado.\nColor de la entidad bancaria.',
    leer: 'Si las dos barras no coinciden, hay movimientos pendientes de conciliar o extractos sin importar. Pulsa la barra de saldo contable para ver sus apuntes.',
  },
  b_conc: {
    t: 'Pendiente de conciliar',
    que: 'Cuántas líneas de extracto bancario están todavía sin conciliar en cada diario.',
    calc: 'Número de líneas de extracto publicadas y no conciliadas.\n• Verde: menos de 5.\n• Ámbar: de 5 a 9.\n• Rojo: 10 o más.',
    leer: 'Cuanto más pendiente, menos fiable es el saldo contable del diario.',
  },
  b_tarjetas: {
    t: 'Diarios por compañía',
    que: 'Una tarjeta por cada diario de banco, tarjeta, caja o cartera, agrupadas por compañía con su total.',
    calc: 'Cada tarjeta muestra el saldo contable, el último extracto, un minigráfico con la previsión del diario hasta el horizonte (rojo si termina en negativo), el saldo final y el mínimo previstos, y etiquetas: líneas por conciliar, fecha del último extracto y si es cartera de inversión.',
    leer: 'Pulsa la tarjeta para ver su previsión debajo; pulsa el saldo para ver sus apuntes.',
  },
  b_prevision: {
    t: 'Previsión del diario',
    que: 'La previsión de tesorería de un solo banco o caja.',
    calc: 'Parte del saldo del diario y aplica:\n• Cobros y pagos programados en ese diario.\n• Cuotas de los ajustes de periodo cuya cuenta de banco es la de ese diario.\n• Estimación de facturas (si está activa en Previsión), solo en el banco principal de cada compañía.\nPrimer descubierto: el primer día en que el saldo previsto queda por debajo de cero.',
    leer: 'Si hay descubierto, conviene traspasar fondos desde otro banco antes de esa fecha.',
  },
  b_mov: {
    t: 'Movimientos previstos del diario',
    que: 'La lista de movimientos que se esperan en el diario elegido hasta el final del horizonte.',
    calc: 'Fecha, tipo (cobro, pago, ajuste o estimación), concepto, importe y saldo acumulado tras cada movimiento.',
    leer: 'Exportable a Excel para cuadrar con el banco.',
  },

  /* ================= Análisis económico-financiero ================= */
  a_activo: {
    t: 'Balance · Activo',
    que: 'Lo que tienen las compañías a fin de cada ejercicio, agrupado como en la plantilla.',
    calc: `Saldos acumulados (debe − haber) a 31/12 de cada año (o a hoy si está en curso) de las cuentas de los grupos 1 a 5:\n• Inmovilizado: 20 intangible, 21 y 23 material, 22 inversiones inmobiliarias, 24–26 y 474 inversiones financieras a largo, 28 y 29 amortizaciones y deterioros (en negativo).\n• Existencias: 30–32 y 39, 33–34 en curso, 35–36 terminados, 407 anticipos a proveedores.\n• Realizable y disponible: 43, 490 y 493 clientes; 473 y 4709 activos por impuesto; 460 y 470–472 otros créditos; 44, 480, 544, 55, 565 y 566 deudores varios; 54 y 59 inversiones a corto; 57 disponible; 53 empresas del grupo.\n${PGC_NOTA}`,
    leer: '% = peso de cada partida sobre el total del activo. Ind. = año / año anterior (1,10 = ha crecido un 10 %). Pulsa un importe para ver sus apuntes.',
    ojo: 'Las cuentas que no encajan en ninguna partida se suman a «deudores varios» (si tienen saldo deudor) u «otras deudas» (acreedor) y se listan en «Cuentas y cuadre».',
  },
  a_pasivo: {
    t: 'Balance · Pasivo y patrimonio neto',
    que: 'Cómo se financian las compañías: fondos propios y deudas a largo y a corto plazo.',
    calc: `Saldos acumulados a 31/12 (en positivo los acreedores):\n• Capital y reservas: 10, 11, 12, 19 y 557, más los resultados de años anteriores que no se hayan regularizado.\n• Resultado del ejercicio: el de la cuenta de explotación del año.\n• Subvenciones: 13. Otros fondos propios: 118. Provisiones para riesgos: 14.\n• Deuda a largo: 15–18 y 479.\n• Deuda a corto: 41 acreedores, 40 proveedores, 465, 466 y 475–477 deudas fiscales y sociales, 438, 485, 50–52 y 56 otras deudas, 499 y 529 provisiones, 520 y 527 bancos, 551–553 y 556 socios.\n${PGC_NOTA}`,
    leer: 'H · Total pasivo debe ser igual a D · Total activo (lo indica la comprobación verde de arriba).',
  },
  a_explotacion: {
    t: 'Cuenta de explotación',
    que: 'Los ingresos y gastos de cada ejercicio y los resultados intermedios, con la estructura de la plantilla.',
    calc: 'Movimientos del año en los grupos 6 y 7, sin los asientos de regularización (los que usan la 129).\n• Producción = cifra de negocio (70) + variación de existencias (71) − subcontratas (607).\n• Margen bruto = producción − compras consumidas (60 y 61).\n• Gastos de funcionamiento: suministros 628, reparaciones 622, transportes 624, diversos (620, 627, 629 y resto del 62).\n• Valor añadido = margen bruto − gastos de funcionamiento.\n• Gastos de estructura: seguros 625, personal 64, servicios bancarios 626, profesionales 623, tributos 631/634/636/639, arrendamientos 621, amortizaciones 68, provisiones y pérdidas de gestión 65 y 69, excesos 79 (en negativo).\n• Resultado de explotación = valor añadido − gastos de estructura.\n• Resultado de actividades ordinarias = resultado de explotación − gastos financieros netos (66 − 76).\n• Resultado neto = anterior + otros ingresos (73–75) + beneficios extraordinarios (77) − pérdidas extraordinarias (67) − impuesto de sociedades (630).\n• Cash-flow = resultado neto + amortizaciones + provisiones.',
    leer: '% = peso sobre la producción. Pulsa un importe para ver sus apuntes.',
    ojo: 'Si el año está en curso, las cifras van del 1 de enero a hoy.',
  },
  a_plantilla: {
    t: 'Plantilla y productividad',
    que: 'Indicadores de productividad por empleado y por euro de sueldos.',
    calc: '• Nº de empleados: no está en la contabilidad; se escribe a mano (el último año se rellena con los empleados actuales de Odoo).\n• Seguridad Social: cuentas 642 y 643.\n• Producción por empleado = producción / empleados. Coste por empleado = gastos de personal / empleados.\n• Producción, margen bruto y beneficio por euro de sueldos = cada uno / gastos de personal.',
    leer: 'Compara la evolución de un año a otro (columna Ind.).',
  },
  a_masas: {
    t: 'Masas patrimoniales',
    que: 'El balance dibujado: qué peso tiene cada gran bloque del activo y del pasivo.',
    calc: '• Activo: inmovilizado, existencias y realizable + disponible.\n• Pasivo: fondos propios (patrimonio + otros fondos propios + provisiones a largo), deuda a largo y deuda a corto.\nLa altura de cada bloque es su peso en el balance. Fondo de maniobra = capitales permanentes − inmovilizado.',
    leer: 'Situación sana: los fondos propios y la deuda a largo cubren todo el inmovilizado y parte del circulante (fondo de maniobra positivo).',
  },
  a_fm_masas: {
    t: 'Fondo de maniobra por masas',
    que: 'Calcula el fondo de maniobra por el lado del pasivo.',
    calc: 'Capitales permanentes (fondos propios + deudas a largo) − inmovilizado, con su variación anual.',
    leer: 'Debe coincidir con el fondo de maniobra aparente del Resumen (activo circulante − pasivo circulante).',
  },
  a_fm: {
    t: 'Fondos de maniobra',
    que: 'Si el circulante de la empresa es suficiente para su ciclo de negocio.',
    calc: '• Aparente = activo circulante (existencias + realizable + disponible) − pasivo circulante (deuda a corto).\n• Necesario = gastos diarios × periodo de maduración − (compras / días × plazo de pago).\n• Gastos diarios = (gastos generales + compras − amortizaciones − provisiones) / días del ejercicio; gastos generales = margen bruto − resultado de actividades ordinarias.\n• Exceso o déficit = aparente − necesario.\n• Días de autonomía = fondo de maniobra aparente / gastos diarios.',
    leer: 'Déficit: la empresa necesita más circulante del que tiene y tenderá a tensiones de tesorería.',
  },
  a_deuda: {
    t: 'Composición de la deuda total',
    que: 'Cuánta deuda es a largo y cuánta a corto plazo.',
    calc: 'Deuda a largo (15–18, 479) y deuda a corto (bloque G del balance). Deuda total = suma. Total balance = total pasivo.',
    leer: 'Mucha deuda a corto respecto a la de largo aumenta el riesgo de liquidez.',
  },
  a_endeud: {
    t: 'Capacidad de endeudamiento',
    que: 'Cuánta deuda más admitiría la empresa y cuánto tardaría en devolver la que tiene con bancos.',
    calc: '• Endeudamiento posible = patrimonio neto / 0,4 − pasivo total (deuda extra sin que los fondos propios bajen del 40 % del pasivo).\n• Ratio de devolución de préstamos = cash-flow / deuda bancaria (bancos a corto + deuda a largo) × 100.',
    leer: 'Endeudamiento negativo: los fondos propios ya están por debajo del 40 %. Devolución del 25 %: con un año de cash-flow se devolvería una cuarta parte de la deuda bancaria.',
  },
  a_sintesis: {
    t: 'Cuadro de síntesis',
    que: 'Las magnitudes clave y su evolución.',
    calc: 'Clientes, proveedores y acreedores, activo real (total − intangible − inversiones financieras), existencias, deuda con bancos, cifra de negocio, gastos generales, resultado neto y gastos de explotación diarios, con la variación absoluta y en % de un año a otro.',
    leer: 'Compara si clientes y deuda crecen más que la cifra de negocio (señal de tensión).',
  },
  r_palm: { t: 'Plazo medio de almacenamiento', que: 'Días que tarda en consumirse o venderse el stock.', calc: 'Existencias medias × días del ejercicio / compras consumidas. El primer año usa las existencias finales; los siguientes, la media con el año anterior.', leer: 'Cuanto menor, menos dinero inmovilizado en almacén. No tiene objetivo fijo: depende del sector.' },
  r_pcob: { t: 'Plazo de cobro', que: 'Días que tardan los clientes en pagar, según el balance.', calc: 'Saldo de clientes × días / (cifra de negocio × 1,21). Se multiplica por 1,21 porque el saldo de clientes incluye IVA y las ventas no.', leer: 'Objetivo: menos de 60 días. Verde si cumple, ámbar hasta un 20 % por encima, rojo más allá.', ojo: 'Si hay ventas exentas o con inversión del sujeto pasivo, el 1,21 sobrestima las ventas y el plazo sale más bajo.' },
  r_ppag: { t: 'Plazo de pago', que: 'Días que tardas en pagar a proveedores, según el balance.', calc: 'Saldo de proveedores × días / (compras consumidas × 1,21).', leer: 'Objetivo: menos de 60 días (límite legal de la Ley 15/2010).' },
  r_mad: { t: 'Período de maduración', que: 'Días que pasan desde que compras hasta que cobras la venta.', calc: 'Plazo de almacenamiento + plazo de cobro.', leer: 'Cuanto más largo, más circulante necesitas para financiar el ciclo.' },
  r_liq: { t: 'Liquidez general', que: 'Si el activo circulante cubre las deudas a corto.', calc: 'Activo circulante (existencias + realizable + disponible) / pasivo circulante.', leer: 'Objetivo: más de 1,5. Por debajo de 1 hay problemas para atender pagos a corto.' },
  r_liqinm: { t: 'Liquidez inmediata (prueba ácida)', que: 'Igual que la liquidez general pero sin contar existencias.', calc: '(Realizable + disponible) / pasivo circulante.', leer: 'Objetivo: más de 0,9.' },
  r_tes: { t: 'Tesorería', que: 'Qué parte de la deuda a corto se pagaría con el dinero disponible.', calc: 'Disponible en caja y bancos (57) / pasivo circulante.', leer: 'Objetivo: más de 0,1.' },
  r_gar: { t: 'Garantía', que: 'Si los bienes reales de la empresa cubren todas sus deudas.', calc: 'Activo real (total − intangible − inversiones financieras) / deuda total.', leer: 'Objetivo: más de 1,5. Por debajo de 1 los activos no cubren las deudas.' },
  r_coste: { t: 'Coste de la deuda', que: 'El tipo de interés medio que pagas por la deuda con coste.', calc: 'Gastos financieros netos (66 − 76) / (bancos a corto + deuda a largo) × 100.', leer: 'Compáralo con los tipos de mercado y con la rentabilidad económica.' },
  r_cobint: { t: 'Cobertura de intereses', que: 'Cuántas veces cubre el beneficio los gastos financieros.', calc: '(Resultado neto + gastos financieros) / gastos financieros.', leer: 'Objetivo: más de 3.' },
  r_incid: { t: 'Incidencias en tesorería', que: 'Cuánto dinero liberan o consumen los cambios en los plazos de stock, cobro y pago respecto al año anterior.', calc: '• Existencias: (plazo anterior − plazo actual) × compras / 360.\n• Cobro: (plazo anterior − plazo actual) × ventas con IVA / 360.\n• Pago: (plazo actual − plazo anterior) × compras con IVA / 360.', leer: 'Positivo: el cambio de plazo ha liberado tesorería. Negativo: la ha consumido.' },
  r_rotac: { t: 'Rotación del activo circulante', que: 'Cuántas veces se renueva el circulante con las ventas.', calc: 'Cifra de negocio / activo circulante.', leer: 'Más alto = el circulante se aprovecha mejor.' },
  r_rotaf: { t: 'Rotación del activo fijo', que: 'Ventas generadas por cada euro de inmovilizado.', calc: 'Cifra de negocio / inmovilizado neto.', leer: 'Más alto = mejor aprovechamiento de las inversiones.' },
  r_rotcp: { t: 'Rotación del capital propio', que: 'Ventas por cada euro de fondos propios.', calc: 'Cifra de negocio / patrimonio neto.', leer: 'Muy alto puede indicar pocos fondos propios.' },
  r_rotcli: { t: 'Rotación de clientes', que: 'Cuántas veces al año se cobra el saldo de clientes.', calc: 'Cifra de negocio / clientes.', leer: '365 / rotación ≈ días de cobro (sin IVA).' },
  r_renteco: { t: 'Rentabilidad económica', que: 'Beneficio que genera cada euro invertido en la empresa.', calc: 'Resultado neto / total activo × 100.', leer: 'Objetivo: más del 3,5 %.' },
  r_rentfin: { t: 'Rentabilidad financiera', que: 'Beneficio para los socios por cada euro de fondos propios.', calc: 'Resultado neto / patrimonio neto × 100.', leer: 'Objetivo: más del 6 %.' },
  r_aut: { t: 'Autonomía financiera', que: 'Qué parte de la financiación es propia.', calc: 'Patrimonio neto / pasivo total.', leer: 'Objetivo: más de 0,4 (al menos el 40 % propio).' },
  r_cfdeuda: { t: 'Cash-flow / deudas totales', que: 'Capacidad de devolver la deuda con lo que genera la empresa.', calc: 'Cash-flow (resultado neto + amortizaciones + provisiones) / deuda total.', leer: 'Objetivo: más de 0,4.' },
  r_z: { t: 'Factor Z', que: 'Puntuación que resume el riesgo de insolvencia (suspensión de pagos).', calc: '−4,2 + 1,35 × liquidez general + 6,5 × autonomía + 7 × rentabilidad económica / 100 + 5 × rentabilidad financiera / 100.', leer: 'Objetivo: más de 0. Valores negativos indican riesgo de insolvencia.' },
  r_fmact: { t: 'Fondo de maniobra / activo', que: 'Peso del fondo de maniobra sobre el total del balance.', calc: 'Fondo de maniobra aparente / total activo.', leer: 'Objetivo: más de 0,3.' },
  a_oa: {
    t: 'Orígenes y aplicaciones de fondos',
    que: 'De dónde ha salido el dinero entre dos ejercicios y a qué se ha dedicado.',
    calc: 'Compara las masas de los dos años elegidos: inmovilizado neto, existencias, realizable (sin disponible ni grupo), disponible (incluye grupo), fondos propios, deuda a largo y deuda a corto.\n• Aplicaciones (usos): aumentos de activo y bajadas de pasivo.\n• Orígenes (fuentes): bajadas de activo y aumentos de pasivo.',
    leer: 'Si el balance cuadra, el total de orígenes y el de aplicaciones coinciden. En el gráfico, verde = origen y coral = aplicación.',
  },
  a_va: {
    t: 'Reparto del valor añadido',
    que: 'Quién se lleva cada euro de valor añadido que genera la empresa.',
    calc: '• Personal: gastos de personal − Seguridad Social.\n• Administraciones: tributos + impuesto de sociedades + Seguridad Social.\n• Bancos: gastos financieros + servicios bancarios.\n• Terceros: seguros + servicios profesionales + arrendamientos.\n• Empresa: amortizaciones + provisiones + excesos − otros ingresos − beneficios extraordinarios + pérdidas extraordinarias.\n• Propiedad: resultado neto.',
    leer: 'La línea de cuadre debe ser 0: la suma de los repartos es el valor añadido.',
  },
  a_umbral: {
    t: 'Umbral de rentabilidad',
    que: 'Las ventas (producción) necesarias para cubrir todos los gastos: a partir de ahí se gana dinero.',
    calc: '• Gastos fijos = gastos de estructura.\n• Margen de contribución = (gastos de estructura + resultado de actividades ordinarias) / producción.\n• Umbral = gastos fijos / margen de contribución.\n• Se alcanza el día: días del ejercicio × umbral / producción.\n• Margen de seguridad = (producción − umbral) / producción.',
    leer: 'En el gráfico, el punto negro es donde la producción acumulada (verde) supera a los gastos totales (coral). Margen de seguridad del 20 %: la producción podría caer un 20 % sin pérdidas.',
    ojo: 'Supone que la producción y los gastos variables se reparten de forma uniforme a lo largo del año.',
  },
  a_graficos: {
    t: 'Gráficos del análisis',
    que: 'La evolución de los 3 ejercicios en seis gráficos.',
    calc: '• Activo y deuda: total activo, deuda a largo y a corto (miles de €).\n• Realizable + disponible frente a deuda a corto.\n• Cifra de negocio, clientes y deuda a corto.\n• Índices de evolución: cada magnitud dividida por su valor del primer año (1 = igual).\n• Producción y gastos: producción, compras, gastos de estructura y de funcionamiento, y resultado ordinario.\n• Peso sobre la producción: compras, gastos y resultado en %.',
    leer: 'Útiles para ver tendencias: si la deuda crece más rápido que la cifra de negocio, o si los gastos ganan peso sobre la producción.',
  },
  a_comprob: {
    t: 'Comprobaciones',
    que: 'Controles de que el análisis cuadra, como en la portada de la plantilla.',
    calc: '• Activo − pasivo: debe ser 0.\n• Resultado del balance − resultado neto de la explotación: debe ser 0.',
    leer: 'En verde «Cuadra». Si sale un importe en rojo, alguna cuenta está mal clasificada o hay asientos descuadrados.',
  },
  a_sinclas: {
    t: 'Cuentas sin clasificar',
    que: 'Cuentas con saldo cuyo código no encaja en ninguna partida de la plantilla.',
    calc: 'Se suman a «deudores varios» si su saldo es deudor y a «otras deudas» si es acreedor (en explotación, a «diversos» u «otros ingresos») para que el balance cuadre. Se muestra su saldo con el signo contable (deudor +, acreedor −).',
    leer: 'Si alguna debería ir a otra partida, se puede añadir su prefijo a la clasificación.',
  },

  /* ================= Apuntes ================= */
  m_kpis: {
    t: 'Totales de los apuntes',
    que: 'El resumen de todos los apuntes que cumplen el filtro (no solo los visibles).',
    calc: '• Apuntes: número de líneas de asiento.\n• Debe y haber: sumas.\n• Saldo = debe − haber. En la deuda de clientes o proveedores se muestra el pendiente (lo que falta por cobrar o pagar).',
    leer: 'Debe coincidir con la cifra del cuadro que has pulsado.',
    ojo: 'En cuentas de pasivo, ingresos o patrimonio el saldo sale negativo aunque el cuadro lo muestre en positivo (el cuadro usa el signo «natural» de cada partida).',
  },
  m_tabla: {
    t: 'Apuntes contables',
    que: 'Las líneas de asiento de Odoo que forman el importe o cumplen la búsqueda.',
    calc: 'Por defecto agrupadas por compañía → cuenta contable → contacto, con los totales de cada grupo; despliega cada nivel para llegar al detalle. Sin agrupar, se listan de 100 en 100 por fecha descendente. Columnas: fecha, asiento (abre el asiento en Odoo), diario, cuenta, contacto, etiqueta y referencia, vencimiento (en deudas), debe, haber, saldo y pendiente.',
    leer: '«Borrador» indica asientos sin publicar. «Descargar Excel» exporta todos los apuntes del filtro (hasta 5.000).',
  },
};

function Text({ s }: { s: string }) {
  const lines = s.split('\n');
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`u${out.length}`}>{list.map((l, i) => <li key={i}>{l}</li>)}</ul>); list = []; } };
  lines.forEach((l, i) => {
    if (l.startsWith('• ')) list.push(l.slice(2));
    else { flush(); if (l.trim()) out.push(<p key={`p${i}`}>{l}</p>); }
  });
  flush();
  return <>{out}</>;
}

/** Enlace «Saber más» que abre la ficha detallada del indicador o tabla. */
export function SaberMas({ id, compact = false }: { id: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const f = INFO[id];
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);
  if (!f) return null;
  return (
    <>
      <button
        type="button" className={`saber ${compact ? 'compact' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={`Saber más: ${f.t}`} aria-label={`Saber más sobre ${f.t}`}
      >
        <span className="i">i</span>{!compact && 'Saber más'}
      </button>
      {open && (
        <div className="saber-overlay" onClick={() => setOpen(false)} role="presentation">
          <div className="saber-modal" role="dialog" aria-modal="true" aria-label={f.t} onClick={(e) => e.stopPropagation()}>
            <div className="saber-head">
              <h3>{f.t}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="saber-body">
              <section><h4>Qué es</h4><Text s={f.que} /></section>
              <section><h4>Cómo se calcula</h4><Text s={f.calc} /></section>
              <section><h4>Cómo leerlo</h4><Text s={f.leer} /></section>
              {f.ojo && <section className="ojo"><h4>A tener en cuenta</h4><Text s={f.ojo} /></section>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
