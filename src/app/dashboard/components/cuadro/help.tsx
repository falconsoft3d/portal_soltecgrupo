/* Ayuda «?» de cada página del cuadro financiero: cómo se forma, en lenguaje sencillo. */
import type { ReactNode } from 'react';

export const HELP: Record<string, { title: string; body: ReactNode }> = {
  '/dashboard/contabilidad-deuda': {
    title: '¿Cómo se forma esta página?',
    body: (
      <>
        <p>Resume la situación contable de las compañías elegidas con los datos de Odoo en el momento de abrirla.</p>
        <ul>
          <li><b>Tesorería total:</b> saldo contable, a fecha de hoy, de todos los diarios de banco y caja. Se separa lo líquido de las cuentas de cartera de inversión (diarios con «cartera» en el nombre).</li>
          <li><b>Pendiente de cobro y de pago:</b> lo que falta por cobrar o pagar de las facturas publicadas. Es <i>atrasado</i> lo que ya pasó su vencimiento.</li>
          <li><b>Posición neta:</b> tesorería + pendiente de cobro − pendiente de pago.</li>
          <li><b>Indicadores de aguja:</b> cobertura de proveedores, disponibilidad, meses de cobertura (tesorería líquida entre la salida media mensual de pagos y ajustes de periodo), morosidad y plazos medios de cobro y pago (pendiente entre lo cobrado o pagado en 12 meses × 365). Verde: correcto; ámbar: vigilar; rojo: riesgo.</li>
          <li><b>Deuda por compañía:</b> al día frente a atrasado, con las facturas de proveedor en borrador (a validar) y las marcadas «por revisar».</li>
          <li><b>Cobros y pagos por mes:</b> pagos publicados de los últimos 24 meses, sin traspasos internos.</li>
          <li><b>Top 10, métodos y proyectos:</b> cobros y pagos de los últimos 12 meses agrupados por contacto, por método de pago y por proyecto.</li>
        </ul>
      </>
    ),
  },
  '/dashboard/prevision-tesoreria': {
    title: '¿Cómo se forma esta previsión?',
    body: (
      <>
        <p>Calcula cómo evolucionará el dinero en bancos, día a día, hasta el horizonte elegido.</p>
        <p>Se parte del saldo de los diarios marcados: el <b>saldo contable</b> de hoy o, si lo eliges, el <b>último estado de cuenta</b>. Sobre él se suman y restan:</p>
        <ul>
          <li><b>Cobros y pagos programados:</b> pagos registrados en Odoo con fecha posterior a hoy (pagarés, confirming, remesas…).</li>
          <li><b>Ajustes de periodo:</b> los asientos recurrentes de Odoo que mueven bancos o caja (nóminas, préstamos, renting, impuestos…). Cada cuota se repite según su frecuencia hasta su fecha fin.</li>
          <li><b>Estimación</b> (opcional): lo pendiente no vencido de facturas de clientes menos el de proveedores, repartido a partes iguales en los días laborables de los próximos 60 días.</li>
        </ul>
        <p>Puedes quitar cualquiera de estos bloques, excluir las cuentas de cartera o elegir solo algunos diarios.</p>
        <p>La <b>cascada</b> muestra cómo se pasa del saldo de hoy al final; el <b>calendario</b>, el neto de cada día (verde: entra más; rojo: sale más); la <b>línea</b>, el saldo diario del grupo y de cada compañía. Las tablas dan el resumen por meses, los movimientos de los próximos 30 días y los ajustes tal como están en Odoo. Si el saldo baja de cero, aparece un aviso con la fecha.</p>
      </>
    ),
  },
  '/dashboard/bancos': {
    title: '¿Cómo se forma esta página?',
    body: (
      <>
        <p>Muestra el estado de cada diario de banco, tarjeta, caja y cartera de las compañías elegidas.</p>
        <ul>
          <li><b>Saldo contable:</b> suma de los apuntes publicados hasta hoy en la cuenta contable del diario.</li>
          <li><b>Último estado de cuenta:</b> saldo final del último extracto importado. La diferencia con el contable suele ser lo pendiente de conciliar.</li>
          <li><b>Pendiente de conciliar:</b> líneas de extracto que aún no se han casado con un apunte. Verde: menos de 5; ámbar: de 5 a 9; rojo: 10 o más.</li>
        </ul>
        <p>Cada tarjeta enseña el saldo, el último extracto y un minigráfico con la previsión del diario, con su saldo final y su mínimo en el horizonte elegido.</p>
        <p>Al pulsar una tarjeta se abre su <b>previsión</b>: parte del saldo del diario y aplica los cobros y pagos programados en ese diario y las cuotas de los ajustes de periodo que lo mueven, con los mismos interruptores que en Previsión de tesorería.</p>
        <p><b>Primer descubierto</b> es el primer día en que el saldo previsto queda por debajo de cero: conviene traspasar fondos antes. La tabla final lista esos movimientos con el saldo acumulado tras cada uno.</p>
      </>
    ),
  },
  '/dashboard/analisis-financiero': {
    title: '¿Cómo se forma este análisis?',
    body: (
      <>
        <p>Reproduce la plantilla «Análisis económico financiero» con tres ejercicios, calculados solos desde la contabilidad de Odoo. Por defecto suma los asientos publicados y los que están en borrador; desmarca «Incluir asientos en borrador» para usar solo los publicados.</p>
        <ul>
          <li><b>Balance:</b> saldos de cada cuenta a 31 de diciembre (o a hoy si el año está en curso), agrupados por su código del Plan General Contable: 20 intangible, 21 material, 43 clientes, 57 bancos, 40 proveedores, 520 deuda bancaria a corto, 17 a largo…</li>
          <li><b>Explotación:</b> movimientos del año en los grupos 6 (gastos) y 7 (ingresos), sin el asiento de regularización, para que el resultado no salga a cero en años cerrados.</li>
        </ul>
        <p>Con esas dos tablas se calcula todo lo demás, con las mismas fórmulas que el Excel: masas patrimoniales y fondo de maniobra, resumen, ratios de plazos, liquidez, solvencia y rentabilidad con su semáforo, factor Z, orígenes y aplicaciones de fondos entre dos años, reparto del valor añadido y umbral de rentabilidad (las ventas necesarias para cubrir todos los gastos).</p>
        <p>Las comprobaciones de arriba deben salir en verde: activo igual a pasivo y resultado del balance igual al de la explotación. Las cuentas que no encajan en ninguna partida se listan en «Cuentas y cuadre». El nº de empleados no está en la contabilidad: se escribe a mano en Explotación.</p>
      </>
    ),
  },
  '/dashboard/apuntes': {
    title: '¿Qué muestra esta página?',
    body: (
      <>
        <p>Lista los <b>apuntes contables</b> de Odoo (líneas de asiento) para que puedas revisar de dónde sale cada cifra.</p>
        <p>Hay dos formas de llegar:</p>
        <ul>
          <li><b>Desde un importe:</b> en Contabilidad y deuda, Previsión, Bancos o el Análisis, al pulsar una cifra subrayada se abre esta página con el filtro exacto que forma ese importe (por ejemplo, la deuda vencida de clientes de una compañía, el saldo de un banco o la partida «Clientes» del balance de un año). Arriba se indica qué estás revisando.</li>
          <li><b>Desde el menú:</b> búsqueda libre por fechas, cuenta (por cómo empieza el código: 430, 57, 6…), diario, contacto o texto, con o sin borradores.</li>
        </ul>
        <p>Las tarjetas suman el debe, el haber y el saldo (debe − haber) de todos los apuntes del filtro, no solo de la página. En cuentas de pasivo, ingresos o patrimonio el saldo sale negativo aunque el cuadro lo muestre en positivo. En la deuda se muestra además lo pendiente de cada apunte.</p>
        <p>El número de asiento abre el asiento en Odoo, y «Descargar CSV» exporta hasta 5.000 apuntes para revisarlos en Excel.</p>
      </>
    ),
  },
};
