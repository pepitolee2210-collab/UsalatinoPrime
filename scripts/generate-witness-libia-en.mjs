import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'Affidavit_Witness_Libia_Beatriz_Solorzano_EN.pdf')

const TITLE = 'AFFIDAVIT OF WITNESS'
const WITNESS_NAME = 'LIBIA BEATRIZ SOLORZANO VILLAMIZAR'
const DOC_LINE = 'Identity Document No. _______________________'

const OPENING = `I, LIBIA BEATRIZ SOLORZANO VILLAMIZAR, an adult of Venezuelan nationality, identified by Identity Document No. _______________________, hereby declare under oath the following:`

const PARAGRAPHS = [
  `I am a neighbor of the family and a very close friend of the mother of Yoliana Yolibeth Soto Goenaga. I have known Yoliana since long before she was pregnant, when she was still a teenager and we lived in the same neighborhood. I clearly remember when she decided to move to Caracas to attend university and better herself. We are the neighbors with whom the family has had the closest and most trusting relationship in our town of Ure\u00f1a, Venezuela, and for that reason I have been present for, and personally know, a great part of her life story and the difficulties she has endured.`,

  `I have full knowledge of the relationship Yoliana had with Erick Jos\u00e9 Sosa M\u00e1rquez, the biological father of the child. I know that he led an extremely disorderly life, without rules, and that he suffered from serious problems of alcohol and drug addiction, in addition to being involved in satanic practices and cults. When Yoliana became pregnant in early 2013, Erick's reaction was one of absolute and cruel rejection. He immediately cast her aside, told her that the baby would be a burden in his life, refused to offer her any kind of help, and abandoned her to be with another woman, subjecting Yoliana to profound emotional and psychological abuse at the moment she needed support the most.`,

  `I was an eyewitness to how Yoliana returned to our town of Ure\u00f1a while pregnant, forced to seek shelter and support from her family because Erick never took responsibility for his daughter. I saw her entire pregnancy and witnessed how she faced it completely alone, dealing with medical complications such as preeclampsia and deep depression. I witnessed her suffering as she watched the father of her child showing off his new partner on social media and publicly acknowledging his other children, while Victoria, being his firstborn, was completely ignored and discriminated against by him.`,

  `This entire situation of abandonment and rejection has profoundly affected Victoria since her birth. As the child grew older, the total absence of a father figure caused her evident emotional harm, leaving lasting scars as she saw how her schoolmates had their fathers while she felt an enormous void. Victoria has had to grow up knowing that her father never showed the slightest interest in her, that he did not give her his surnames, and that he rejected her from the time she was in her mother's womb \u2014 all of which caused her sorrow and exposed her to an emotionally very harmful situation.`,

  `Faced with this absolute abandonment, Yoliana had to make very difficult decisions to protect and provide for her daughter. Having no support from the father, Yoliana decided to start a clothing business called "Victoria Forever" in order to support the child. Later, in order to protect the life and integrity of her daughter from serious death threats perpetrated by armed groups and "colectivos" of the Venezuelan government, and in the absence of a father who could defend them, Yoliana made the courageous decision to flee the country, emigrating first to Ecuador and, some time later, undertaking a dangerous journey toward the United States.`,

  `From the moment they separated and she informed him of the pregnancy, the absent father completely abandoned his role. Erick has never contributed a single cent toward the support, food, medical expenses, or education of Victoria. There has been no emotional involvement of any kind \u2014 no calls, no visits. I also know that, years later, when Yoliana was experiencing extreme hardship in Ecuador and tried to contact him to ask for a minimum amount of support for the child, he flatly refused, arguing that he already had his own family and could not help her.`,

  `As a result of this lack of support, Yoliana and Victoria were forced to face situations of extreme vulnerability. They had to leave their home in Venezuela, losing their business and their property due to political persecution. In Ecuador they suffered xenophobia and severe economic hardship, and when Yoliana attempted to return to Venezuela in 2023, she was again intimidated and threatened by local authorities, which forced her to flee under extremely precarious conditions \u2014 crossing the jungle and even becoming victims of a terrible kidnapping in Mexico \u2014 all while the biological father remained in absolute indifference.`,

  `From the moment of the separation and throughout the entire life of the child, Yoliana has been her sole caregiver and provider. She has unconditionally assumed the responsibility of providing stability, protection, education, and medical care to Victoria. Yoliana has worked tirelessly \u2014 selling on the streets, cleaning, working as a waitress, and now working in the United States \u2014 to ensure that her daughter lacks nothing, covering the cost of her asthma treatment, her ADHD care, and her psychological therapy. Victoria has always counted solely and exclusively on her mother.`,

  `Despite all the trauma suffered due to paternal abandonment and the difficult migration experiences, Victoria is a resilient child with a good character. Thanks to the love, dedication, and unwavering effort of her mother, the child today attends school, feels safe, has friends, and enjoys a peaceful life. She has demonstrated maturity and good behavior, finding in her mother the refuge and stability that allowed her to overcome adversity.`,

  `To this day, the absent father has absolutely no active presence in the minor's life. His abandonment is total and definitive. He continues to lead a disorderly, unstable life, without employment, and struggling with his own addiction problems. There has never been a significant father-daughter bond, nor even sporadic contact that would demonstrate any kind of interest or concern for his daughter's well-being, health, or development.`,

  `For all of the above, I consider that the reunification of Victoria with her biological father is completely unfeasible and would represent an imminent risk to the safety and emotional and physical integrity of the child, given his history of neglect, abandonment, addiction, and failure to protect. It is absolutely necessary and in the best interest of the minor that custody and guardianship remain exclusively with her mother, Yoliana, who is the only person who has watched over her well-being from the first day of her life.`,

  `I declare that all statements made in this document are true and correct, and I ratify this declaration under penalty of perjury in accordance with applicable law.`,
]

const DATE_LINE = 'Date: _______________________'

const SIGN_BLOCK = [
  '_______________________________',
  'LIBIA BEATRIZ SOLORZANO VILLAMIZAR',
  'Identity Document No. _______________________',
  'Signature',
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

  // Title block
  drawCentered(TITLE, fontBold, 14)
  y -= 2
  drawCentered(WITNESS_NAME, fontBold, 12)
  y -= 2
  drawCentered(DOC_LINE, font, 11)
  y -= 18

  // Opening
  drawParagraph(OPENING, font, 11, { spaceAfter: 14 })

  // Body
  for (const p of PARAGRAPHS) {
    drawParagraph(p, font, 11, { spaceAfter: 10 })
  }

  // Date + signature
  drawParagraph(DATE_LINE, font, 11, { spaceAfter: 36, align: 'left' })
  for (const line of SIGN_BLOCK) {
    ensureSpace(16)
    const isName = line === WITNESS_NAME
    page.drawText(line, {
      x: margin.left,
      y: y - 11,
      size: 11,
      font: isName ? fontBold : font,
      color: black,
    })
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
