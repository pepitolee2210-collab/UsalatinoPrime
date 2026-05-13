import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'Renuncia_Voluntaria_Edinson_Medina_YNES.pdf')

const TITLE = 'RENUNCIA VOLUNTARIA DE PATRIA POTESTAD Y CUSTODIA'
const SUBTITLE = '(Para proceso de tutela ante la corte juvenil del Estado de Washington, Estados Unidos de América)'

const OPENING = 'Yo, EDINSON ROBERTO MEDINA SANCHEZ, identificado con Documento Nacional de Identidad (DNI) del Peru N° 32990314, de nacionalidad peruana, nacido en Chimbote, Ancash, Peru, y actualmente residiendo en la provincia de Chimbote, Ancash, Peru, encontrandome en pleno uso de mis facultades mentales y actuando de manera libre, voluntaria, consciente y sin ningun tipo de coaccion, presion, enga\u00f1o ni violencia, por medio del presente documento manifiesto y declaro lo siguiente:'

const HEADER_DECLARE = 'DECLARO Y MANIFIESTO:'

const POINTS = [
  'PRIMERO. Que soy el padre biologico de la menor VALERIA MEDINA ESCALANTE, nacida el catorce (14) de julio del a\u00f1o 2009 en Bellavista, Callao, Peru, conforme consta en su respectiva partida de nacimiento.',

  'SEGUNDO. Que la madre biologica de mi hija es la se\u00f1ora YNES ESCALANTE LOAIZA, con quien tuve una relacion sentimental de la cual nacio nuestra hija, y de quien conozco que actualmente reside junto a nuestra menor hija en 19913 137TH Ave. E, Graham, Washington 98338, Estados Unidos de America.',

  'TERCERO. Que, con profundo sentimiento de culpa y arrepentimiento, reconozco ante las autoridades que desde que tuve conocimiento del embarazo y desde el nacimiento de mi hija Valeria, me apar\u00e9 voluntariamente de mis deberes paternos y no asumi las responsabilidades morales, afectivas ni economicas que me correspondian como padre. Admito con honestidad que mi ausencia fue constante, prolongada y absoluta durante toda la ni\u00f1ez y adolescencia de mi hija.',

  'CUARTO. Que reconozco haber incurrido en una grave y reiterada negligencia paterna. Acepto que fui yo, y solo yo, quien decidio no estar presente en los momentos importantes de la vida de mi hija: no la acompa\u00f1e en sus cumplea\u00f1os, no asisti a sus actuaciones escolares aun cuando ella me lo solicito con ilusion, no respondi oportunamente a sus llamadas ni a sus mensajes, y no cumpli con las promesas que en ocasiones le hice de visitarla, llamarla o brindarle apoyo. Reconozco que mi conducta fue la de un padre ausente y negligente y que con ella le cause un profundo da\u00f1o emocional que lamento.',

  'QUINTO. Que reconozco y acepto que durante toda la vida de mi hija Valeria, fue la se\u00f1ora Ynes Escalante Loaiza, madre biologica, quien asumio de manera exclusiva, integra y constante todas las cargas emocionales, afectivas, economicas y de cuidado de nuestra hija. Ella ha sido su unico sosten, su unico apoyo y la unica figura parental verdaderamente presente en su vida.',

  'SEXTO. Que, por las razones anteriormente expuestas, y en virtud de mi propia conducta negligente a lo largo de los a\u00f1os, acepto que no me encuentro en condiciones morales ni materiales para ejercer la patria potestad, la custodia ni el cuidado de mi hija. Reconozco igualmente que el vinculo paterno-filial entre ella y yo se encuentra irreparablemente quebrantado por mi propia responsabilidad y por mi propia decision de no haber estado presente.',

  'SEPTIMO. Que, en consecuencia, de manera libre, voluntaria, permanente e irrevocable, RENUNCIO a todos mis derechos de patria potestad, custodia fisica y custodia legal sobre mi hija VALERIA MEDINA ESCALANTE, reconociendo que la custodia exclusiva debe recaer en su madre biologica, la se\u00f1ora YNES ESCALANTE LOAIZA.',

  'OCTAVO. Que no tengo objecion alguna y, por el contrario, manifiesto mi total conformidad y consentimiento para que la se\u00f1ora Ynes Escalante Loaiza ejerza de manera exclusiva, total e integra la tutela legal, la custodia y la guarda de nuestra menor hija, asi como para que tome en su exclusivo nombre todas las decisiones relativas a su educacion, salud, bienestar, residencia, proteccion y desarrollo integral, conforme a la legislacion aplicable.',

  'NOVENO. Que esta decision la tomo asumiendo plenamente la responsabilidad por mi conducta pasada, y en el mejor interes superior de mi hija, con la unica finalidad de garantizar su proteccion, su estabilidad emocional, su continuidad academica y su bienestar general.',
]

const CLOSING = 'POR LO TANTO, firmo el presente documento en pleno conocimiento de su contenido y de las consecuencias legales que del mismo se deriven, con la intencion de que surta todos sus efectos ante las autoridades correspondientes.'

const SIGN_LINE = 'En la ciudad de ____________________, Peru, el dia _____ del mes de _______________ del a\u00f1o _________.'

const SIGN_BLOCK = [
  'Firma: ____________________________________',
  'EDINSON ROBERTO MEDINA SANCHEZ',
  'DNI N\u00b0 32990314',
]

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let current = ''
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w
    const width = font.widthOfTextAtSize(trial, size)
    if (width > maxWidth && current) {
      lines.push(current)
      current = w
    } else {
      current = trial
    }
  }
  if (current) lines.push(current)
  return lines
}

async function main() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.TimesRoman)
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const fontItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)

  const pageSize = [612, 792] // Letter
  const margin = { top: 72, bottom: 72, left: 72, right: 72 }
  const maxWidth = pageSize[0] - margin.left - margin.right

  let page = doc.addPage(pageSize)
  let y = pageSize[1] - margin.top

  const black = rgb(0, 0, 0)

  function ensureSpace(needed) {
    if (y - needed < margin.bottom) {
      page = doc.addPage(pageSize)
      y = pageSize[1] - margin.top
    }
  }

  function drawCentered(text, f, size) {
    const width = f.widthOfTextAtSize(text, size)
    const x = (pageSize[0] - width) / 2
    ensureSpace(size + 4)
    page.drawText(text, { x, y: y - size, size, font: f, color: black })
    y -= size + 4
  }

  function drawParagraph(text, f, size, { indent = 0, lineGap = 4, spaceAfter = 10, align = 'justify' } = {}) {
    const lines = wrapText(text, f, size, maxWidth - indent)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      ensureSpace(size + lineGap)
      if (align === 'justify' && i < lines.length - 1) {
        const words = line.split(' ')
        if (words.length > 1) {
          const textWidth = f.widthOfTextAtSize(line, size)
          const extra = (maxWidth - indent - textWidth) / (words.length - 1)
          let x = margin.left + indent
          for (let j = 0; j < words.length; j++) {
            page.drawText(words[j], { x, y: y - size, size, font: f, color: black })
            const ww = f.widthOfTextAtSize(words[j], size)
            const sp = f.widthOfTextAtSize(' ', size)
            x += ww + sp + extra
          }
        } else {
          page.drawText(line, { x: margin.left + indent, y: y - size, size, font: f, color: black })
        }
      } else {
        page.drawText(line, { x: margin.left + indent, y: y - size, size, font: f, color: black })
      }
      y -= size + lineGap
    }
    y -= spaceAfter
  }

  // Title
  drawCentered(TITLE, fontBold, 14)
  y -= 4
  drawCentered(SUBTITLE, fontItalic, 11)
  y -= 18

  // Opening paragraph
  drawParagraph(OPENING, font, 11, { spaceAfter: 14 })

  // DECLARE header
  ensureSpace(18)
  page.drawText(HEADER_DECLARE, { x: margin.left, y: y - 12, size: 12, font: fontBold, color: black })
  y -= 22

  // Points
  for (const p of POINTS) {
    drawParagraph(p, font, 11, { spaceAfter: 10 })
  }

  // Closing
  drawParagraph(CLOSING, font, 11, { spaceAfter: 18 })

  // Signing line
  drawParagraph(SIGN_LINE, font, 11, { spaceAfter: 36, align: 'left' })

  // Signature block
  for (const line of SIGN_BLOCK) {
    ensureSpace(16)
    page.drawText(line, { x: margin.left, y: y - 11, size: 11, font: line.startsWith('Firma') ? font : fontBold, color: black })
    y -= 15
  }

  const bytes = await doc.save()
  writeFileSync(OUT_PATH, bytes)
  console.log('PDF generado:', OUT_PATH)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
