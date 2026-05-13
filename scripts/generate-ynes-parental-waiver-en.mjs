import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'Voluntary_Relinquishment_Edinson_Medina_YNES.pdf')

const TITLE = 'VOLUNTARY RELINQUISHMENT OF PARENTAL CUSTODY'
const SUBTITLE = '(For guardianship proceedings in the State of Washington, United States of America)'

const OPENING = 'I, EDINSON ROBERTO MEDINA SANCHEZ, identified with Peruvian National Identity Document (DNI) No. 32990314, of Peruvian nationality, born in Chimbote, Ancash, Peru, and currently residing in the province of Chimbote, Ancash, Peru, being of sound mind and acting freely, voluntarily, knowingly, and without any form of coercion, pressure, deceit, or violence, hereby state and affirm the following:'

const HEADER_DECLARE = 'I DECLARE AND STATE:'

const POINTS = [
  'FIRST. That I am the biological father of the minor VALERIA MEDINA ESCALANTE, born on July 14, 2009, in Bellavista, Callao, Peru, as recorded in her birth certificate.',

  'SECOND. That the biological mother of my daughter is Mrs. YNES ESCALANTE LOAIZA, with whom I had a sentimental relationship from which our daughter was born, and who I know currently resides together with our minor daughter at 19913 137TH Ave. E, Graham, Washington 98338, United States of America.',

  'THIRD. That, with a deep sense of guilt and remorse, I acknowledge before the competent authorities that, from the moment I learned of the pregnancy and from the birth of my daughter Valeria, I voluntarily distanced myself from my fatherly duties and did not assume the moral, emotional, or financial responsibilities that corresponded to me as her father. I honestly admit that my absence was constant, prolonged, and absolute throughout my daughter\u2019s childhood and adolescence.',

  'FOURTH. That I acknowledge having incurred in a serious and repeated parental negligence. I accept that it was I, and only I, who decided not to be present in the important moments of my daughter\u2019s life: I did not accompany her on her birthdays, I did not attend her school performances even when she asked me with great hope, I did not respond in a timely manner to her calls or messages, and I did not keep the promises that I occasionally made to visit her, call her, or support her. I recognize that my conduct was that of an absent and negligent father, and that through it I caused her profound emotional harm, which I now regret.',

  'FIFTH. That I acknowledge and accept that, throughout the entire life of my daughter Valeria, it has been Mrs. Ynes Escalante Loaiza, her biological mother, who has exclusively, fully, and continuously assumed all emotional, affective, financial, and caregiving burdens related to our daughter. She has been her sole provider, her sole support, and the only truly present parental figure in her life.',

  'SIXTH. That, for the reasons set forth above, and by virtue of my own negligent conduct over the years, I accept that I am not in a moral or material position to exercise parental authority, custody, or care over my daughter. I likewise acknowledge that the parent-child bond between her and me has been irreparably broken due to my own responsibility and my own decision not to have been present.',

  'SEVENTH. That, consequently, freely, voluntarily, permanently, and irrevocably, I RELINQUISH all of my parental rights, physical custody, and legal custody over my daughter VALERIA MEDINA ESCALANTE, recognizing that sole custody must rest with her biological mother, Mrs. YNES ESCALANTE LOAIZA.',

  'EIGHTH. That I have no objection whatsoever and, on the contrary, I hereby express my full consent and agreement for Mrs. Ynes Escalante Loaiza to exercise, exclusively and entirely, the legal guardianship, custody, and care of our minor daughter, as well as to make, in her sole name, all decisions relating to her education, health, well-being, residence, protection, and integral development, in accordance with applicable law.',

  'NINTH. That I make this decision fully assuming responsibility for my past conduct, and in the best interest of my daughter, with the sole purpose of guaranteeing her protection, her emotional stability, her academic continuity, and her overall well-being.',
]

const CLOSING = 'THEREFORE, I sign this document in full understanding of its contents and of the legal consequences that may derive therefrom, intending it to take effect before all appropriate authorities.'

const SIGN_LINE = 'In the city of ____________________, Peru, on this _____ day of _______________, of the year _________.'

const SIGN_BLOCK = [
  'Signature: ____________________________________',
  'EDINSON ROBERTO MEDINA SANCHEZ',
  'DNI No. 32990314',
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

  const pageSize = [612, 792]
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

  drawCentered(TITLE, fontBold, 14)
  y -= 4
  drawCentered(SUBTITLE, fontItalic, 11)
  y -= 18

  drawParagraph(OPENING, font, 11, { spaceAfter: 14 })

  ensureSpace(18)
  page.drawText(HEADER_DECLARE, { x: margin.left, y: y - 12, size: 12, font: fontBold, color: black })
  y -= 22

  for (const p of POINTS) {
    drawParagraph(p, font, 11, { spaceAfter: 10 })
  }

  drawParagraph(CLOSING, font, 11, { spaceAfter: 18 })
  drawParagraph(SIGN_LINE, font, 11, { spaceAfter: 36, align: 'left' })

  for (const line of SIGN_BLOCK) {
    ensureSpace(16)
    page.drawText(line, { x: margin.left, y: y - 11, size: 11, font: line.startsWith('Signature') ? font : fontBold, color: black })
    y -= 15
  }

  const bytes = await doc.save()
  writeFileSync(OUT_PATH, bytes)
  console.log('PDF generated:', OUT_PATH)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
