# -*- coding: utf-8 -*-
"""Пересобирает страницу «сюжет» в группы.drawio из levels_story.json (+ story_meta.json).

Слова и описания спрятаны в раскрывающиеся списки:
группа -> «Сюжет группы» и уровни -> слова -> описание.
Каждый пункт — контейнер с collapsible=1, в файле он записан свёрнутым
(collapsed="1"), а размер в раскрытом виде хранится в alternateBounds.
Страница «ПЛАН (группы.txt)» сохраняется как есть.
"""
import json
import re

DST = "группы.drawio"      # итоговый файл (страница «ПЛАН» остаётся)
SRC = "levels_story.json"  # уровни, темы, слова и тексты уровней
META = "story_meta.json"   # группы (открытия), эпилог

PAGE_ID = "story-json"
PAGE_NAME = "сюжет (levels_story.json)"

# цвета групп: id -> (заливка, обводка)
COLORS = {
    1: ("#dae8fc", "#6c8ebf"),
    2: ("#d5e8d4", "#82b366"),
    3: ("#ffe6cc", "#d79b00"),
    4: ("#f8cecc", "#b85450"),
    5: ("#e1d5e7", "#9673a6"),
    6: ("#fff2cc", "#d6b656"),
    7: ("#f5f5f5", "#999999"),
}

# --- геометрия ---
SW_W = 820          # ширина дорожки группы
SW_PAD = 20         # поля внутри дорожки
SW_HEAD = 40        # заголовок дорожки
ITEM_SP = 10        # зазор между пунктами внутри дорожки
BAR_LVL = 28        # высота свёрнутого уровня / «сюжета»
BAR_WORD = 24       # высота свёрнутого слова
LVL_PAD = 10        # поля внутри уровня
LVL_TOP = 8         # отступ от заголовка пункта до содержимого
LVL_SP = 6          # зазор между словами внутри уровня
WORD_PAD = 12       # поля внутри слова
WORD_TOP = 4        # отступ от заголовка слова до описания
WORD_BOTTOM = 8
FONT = 11           # кегль текстов
COL_W = 860         # шаг колонок
ROW_GAP = 50        # зазор между рядами дорожек
GAP = 50            # зазор до легенды

TEXT_BOX = ("rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;"
            "spacingLeft=8;spacingRight=8;spacingTop=6;spacingBottom=6;"
            "fontSize=%d;fontColor=#333333;fillColor=#fafafa;strokeColor=#dddddd;" % FONT)
PLAIN_TEXT = ("text;html=1;align=left;verticalAlign=top;fontSize=%d;"
              "fontColor=#333333;whiteSpace=wrap;" % FONT)
LEGEND = ("rounded=1;arcSize=8;whiteSpace=wrap;html=1;align=left;verticalAlign=top;"
          "spacingLeft=10;spacingRight=8;spacingTop=8;fontSize=%d;"
          "fillColor=#fdf6e3;strokeColor=#d6b656;" % FONT)


def plural(n, one, few, many):
    """Русское склонение: 1 уровень, 2 уровня, 5 уровней."""
    if n % 10 == 1 and n % 100 != 11:
        return one
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return few
    return many


def esc(text):
    return (str(text).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def plain(html):
    """HTML подписи -> простой текст (для оценки числа строк)."""
    return re.sub(r"<[^>]+>", "", re.sub(r"<br\s*/?>", "\n", html))


def wrap_count(para, cpl):
    if not para:
        return 1
    lines, cur = 1, 0
    for word in para.split():
        add = len(word) + (1 if cur else 0)
        if cur and cur + add > cpl:
            lines += 1
            cur = len(word)
        else:
            cur += add
    return lines


def text_height(html, width, avg=0.545, pad_top=6, pad_bottom=6, font=FONT):
    """Оценка высоты текстового блока по числу строк (запас ~15% к строке 1.2em)."""
    cpl = max(10, int((width - 4) / (font * avg)))
    lines = sum(wrap_count(p, cpl) for p in plain(html).split("\n"))
    return int(round(pad_top + pad_bottom + lines * font * 1.25 + 2))


class Cell:
    """Ячейка drawio: вершина с геометрией и (для раскрывающихся) alternateBounds."""

    def __init__(self, cid, value, style, parent, geo, alt=None, collapsed=False):
        self.cid, self.value, self.style = cid, value, style
        self.parent, self.geo, self.alt = parent, geo, alt
        self.collapsed = collapsed

    def xml(self, indent):
        pad = " " * indent
        attrs = {"id": self.cid, "parent": self.parent, "style": self.style,
                 "value": self.value, "vertex": "1"}
        if self.collapsed:
            attrs["collapsed"] = "1"
        out = [pad + "<mxCell " + " ".join(
            '%s="%s"' % (k, esc(v)) for k, v in sorted(attrs.items())) + ">"]
        x, y, w, h = self.geo
        gattrs = {"as": "geometry", "height": h, "width": w, "x": x, "y": y}
        gline = " " * (indent + 4) + "<mxGeometry " + " ".join(
            '%s="%s"' % (k, v) for k, v in sorted(gattrs.items()))
        if self.alt is None:
            out.append(gline + "/>")
        else:
            ax, ay, aw, ah = self.alt
            aattrs = {"as": "alternateBounds", "height": ah, "width": aw, "x": ax, "y": ay}
            out.append(gline + ">")
            out.append(" " * (indent + 8) + "<mxRectangle " + " ".join(
                '%s="%s"' % (k, v) for k, v in sorted(aattrs.items())) + "/>")
            out.append(" " * (indent + 4) + "</mxGeometry>")
        out.append(pad + "</mxCell>")
        return "\n".join(out)


def style_group(fill, stroke):
    """Дорожка группы: контейнер со списочной раскладкой по вертикали."""
    return ("swimlane;html=1;whiteSpace=wrap;container=1;collapsible=0;startSize=%d;"
            "fillColor=%s;strokeColor=%s;fontSize=12;fontStyle=1;verticalAlign=middle;"
            "childLayout=stackLayout;horizontal=1;horizontalStack=0;stackSpacing=%d;"
            "resizeParent=1;resizeParentMax=0;resizeLast=0;"
            "marginLeft=%d;marginRight=%d;marginTop=%d;marginBottom=%d;"
            % (SW_HEAD, fill, stroke, ITEM_SP, SW_PAD, SW_PAD, SW_PAD, SW_PAD))


def style_item(fill, stroke, font, font_style, start, pad, top, spacing, bottom):
    """Раскрывающийся пункт списка со своей вертикальной раскладкой."""
    return ("swimlane;html=1;whiteSpace=wrap;container=1;collapsible=1;recursiveResize=0;"
            "resizeParent=1;resizeParentMax=0;resizeLast=0;startSize=%d;"
            "fillColor=%s;swimlaneFillColor=#ffffff;strokeColor=%s;"
            "fontSize=%d;fontStyle=%d;align=left;verticalAlign=middle;spacingLeft=8;"
            "childLayout=stackLayout;horizontal=1;horizontalStack=0;stackSpacing=%d;"
            "marginLeft=%d;marginRight=%d;marginTop=%d;marginBottom=%d;"
            % (start, fill, stroke, font, font_style, spacing, pad, pad, top, bottom))


def build_page(levels, meta):
    cells = []
    add = cells.append

    add(Cell("s-title", "Сюжетная версия (levels_story.json) · уровней: %d" % len(levels),
             "text;html=1;align=left;verticalAlign=middle;fontSize=16;fontStyle=1;",
             "1", (40, 12, 900, 28)))

    groups = list(meta.get("groups") or [])
    if not groups:
        seen = {}
        for lv in levels:
            seen.setdefault(lv.get("groupId", 0), lv.get("group", "?"))
        groups = [{"id": gid, "name": name, "unlocks": []}
                  for gid, name in sorted(seen.items())]

    items = []
    for g in groups:
        items.append((g, sorted([lv for lv in levels if lv.get("groupId") == g["id"]],
                                key=lambda l: l["id"])))

    heights = {g["id"]: SW_HEAD + SW_PAD + (1 + len(lvls)) * BAR_LVL
               + len(lvls) * ITEM_SP + SW_PAD for g, lvls in items}

    # раскладка по 4 колонки, последняя ячейка — эпилог и легенда
    slots = [(i % 4, i // 4) for i in range(len(items) + 1)]
    row_y, y = [], 60
    for row in sorted({s[1] for s in slots}):
        row_y.append(y)
        row_h = [heights[g["id"]] for (g, _), (_, r) in zip(items, slots) if r == row]
        y += max(row_h + [200]) + ROW_GAP
    row_y.append(y)

    texts_w = SW_W - 2 * SW_PAD - 2 * LVL_PAD            # ширина содержимого уровня
    item_w = SW_W - 2 * SW_PAD                           # ширина пункта списка
    word_style = style_item("#f5f5f5", "#c0c0c0", FONT, 0, BAR_WORD, WORD_PAD,
                            WORD_TOP, 0, WORD_BOTTOM)

    for (g, lvls), (col, row) in zip(items, slots):
        gx, gy = 40 + col * COL_W, row_y[row]
        fill, stroke = COLORS.get(g["id"], ("#ffffff", "#666666"))
        unlocks = g.get("unlocks") or []
        tail = ("открывает: %s" % ", ".join(str(u) for u in unlocks)
                if unlocks else "конечная ветка")
        head = "Группа %s. %s · %d %s · %s" % (
            g["id"], g["name"], len(lvls),
            plural(len(lvls), "уровень", "уровня", "уровней"), tail)
        add(Cell("s-g%s" % g["id"], head, style_group(fill, stroke), "1",
                 (gx, gy, SW_W, heights[g["id"]])))

        story_style = style_item(fill, stroke, 12, 1, BAR_LVL, LVL_PAD, LVL_TOP,
                                 0, LVL_PAD)
        lvl_style = style_item(fill, stroke, 12, 1, BAR_LVL, LVL_PAD, LVL_TOP,
                               LVL_SP, LVL_PAD)
        item_x, iy = gx + SW_PAD, gy + SW_HEAD + SW_PAD

        # «Сюжет группы»: вход, выбор, финал
        story = ("<b>Вход.</b> %s<br><br><b>Выбор.</b> %s<br><br><b>Финал.</b> %s"
                 % (g.get("enter", ""), g.get("select", ""), g.get("complete", "")))
        cid = "s-g%s-story" % g["id"]
        box_h = text_height(story, texts_w, avg=0.575)
        add(Cell(cid, "Сюжет группы: вход · выбор · финал", story_style, "s-g%s" % g["id"],
                 (item_x, iy, item_w, BAR_LVL),
                 alt=(item_x, iy, item_w, BAR_LVL + LVL_TOP + box_h + LVL_PAD),
                 collapsed=True))
        add(Cell(cid + "-box", story, TEXT_BOX, cid,
                 (item_x + LVL_PAD, iy + BAR_LVL + LVL_TOP, texts_w, box_h)))
        iy += BAR_LVL + ITEM_SP

        for lv in lvls:
            words = lv["words"]
            head = "%s. %s (%d&times;%d) · %d %s · улика: %s" % (
                lv["id"], lv["theme"], lv["width"], lv["height"], len(words),
                plural(len(words), "слово", "слова", "слов"), lv["clue"])
            texts = "<b>Старт:</b> %s<br><br><b>Финал:</b> %s" % (
                lv.get("startText", ""), lv.get("completeText", ""))
            texts_h = text_height(texts, texts_w, avg=0.575)
            word_h = [BAR_WORD + WORD_TOP + text_height(w["description"], texts_w - 2 * WORD_PAD)
                      + WORD_BOTTOM for w in words]
            lvl_h = (BAR_LVL + LVL_TOP + texts_h + LVL_SP + sum(word_h)
                     + LVL_SP * (len(words) - 1) + LVL_PAD)

            cid = "s-l%s" % lv["id"]
            add(Cell(cid, head, lvl_style, "s-g%s" % g["id"],
                     (item_x, iy, item_w, BAR_LVL),
                     alt=(item_x, iy, item_w, lvl_h), collapsed=True))
            add(Cell(cid + "-box", texts, TEXT_BOX, cid,
                     (item_x + LVL_PAD, iy + BAR_LVL + LVL_TOP, texts_w, texts_h)))

            wy, wx = iy + BAR_LVL + LVL_TOP + texts_h + LVL_SP, item_x + LVL_PAD
            for w, wh in zip(words, word_h):
                wid = "%s-w%s" % (cid, w["id"])
                add(Cell(wid, "<b>%s</b> — %d %s" % (
                    w["word"], w["letters"],
                    plural(w["letters"], "буква", "буквы", "букв")),
                    word_style, cid, (wx, wy, texts_w, BAR_WORD),
                    alt=(wx, wy, texts_w, wh), collapsed=True))
                add(Cell(wid + "-desc", w["description"], PLAIN_TEXT, wid,
                         (wx + WORD_PAD, wy + BAR_WORD + WORD_TOP,
                          texts_w - 2 * WORD_PAD,
                          wh - BAR_WORD - WORD_TOP - WORD_BOTTOM)))
                wy += wh + LVL_SP
            iy += BAR_LVL + ITEM_SP

    # эпилог и легенда
    col, row = slots[len(items)]
    ex, ey = 40 + col * COL_W, row_y[row]
    epilogue = meta.get("epilogue", "")
    if epilogue:
        box_h = text_height(epilogue, SW_W - 2 * LVL_PAD)
        add(Cell("s-epilogue", "Эпилог: траурное чаепитие",
                 style_item("#f5f5f5", "#999999", 12, 1, BAR_LVL, LVL_PAD, LVL_TOP,
                            0, LVL_PAD), "1", (ex, ey, SW_W, BAR_LVL),
                 alt=(ex, ey, SW_W, BAR_LVL + LVL_TOP + box_h + LVL_PAD),
                 collapsed=True))
        add(Cell("s-epilogue-box", epilogue, TEXT_BOX, "s-epilogue",
                 (ex + LVL_PAD, ey + BAR_LVL + LVL_TOP, SW_W - 2 * LVL_PAD, box_h)))
        ey += BAR_LVL + GAP

    legend = (
        "<b>Слова и описания скрыты в раскрывающихся списках</b><br>"
        "· «+» у пункта уровня — тексты уровня (старт и финал) и список слов.<br>"
        "· «+» у слова — его описание.<br>"
        "· «+» у «Сюжет группы» — вход, выбор и финал группы.<br>"
        "· «+» у эпилога — финал всей истории.<br><br>"
        "<b>Источник:</b> levels_story.json — id, group, groupId, theme, description "
        "(размер), width/height, grid, shapes, words[] (word, description, letters, "
        "dir), clue, startText, completeText, groupEnterText / groupSelectText / "
        "groupCompleteText. Открытия групп и эпилог — story_meta.json."
    )
    legend_h = text_height(legend, SW_W - 18, avg=0.575, pad_top=8, pad_bottom=8)
    add(Cell("s-legend", legend, LEGEND, "1", (ex, ey, SW_W, legend_h)))

    page_h = int(max(row_y[-1], ey + legend_h) + 60)
    body = ['    <diagram id="%s" name="%s">' % (PAGE_ID, PAGE_NAME),
            '        <mxGraphModel dx="6134" dy="1461" grid="1" gridSize="10" '
            'guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" '
            'pageScale="1" pageWidth="3480" pageHeight="%d" math="0" shadow="0">' % page_h,
            "            <root>",
            '                <mxCell id="0"/>',
            '                <mxCell id="1" parent="0"/>']
    body += [c.xml(16) for c in cells]
    body += ["            </root>", "        </mxGraphModel>", "    </diagram>"]
    return "\n".join(body)


def main():
    with open(SRC, encoding="utf-8") as f:
        levels = json.load(f)
    with open(META, encoding="utf-8") as f:
        meta = json.load(f)

    # тексты групп лежат в самих уровнях (groupEnterText и т.д.)
    for g in meta.get("groups", []):
        for lv in levels:
            if lv.get("groupId") == g["id"]:
                g.update(enter=lv.get("groupEnterText", ""),
                         select=lv.get("groupSelectText", ""),
                         complete=lv.get("groupCompleteText", ""))
                break

    with open(DST, encoding="utf-8") as f:
        src = f.read()
    pages = re.findall(r"    <diagram\b.*?</diagram>", src, re.S)
    # оставляем страницу «ПЛАН (группы.txt)», остальные пересобираем заново
    plan = [p for p in pages if 'id="groups-txt"' in p] or pages[:1]
    if not plan:
        raise SystemExit("Не найдена страница «ПЛАН (группы.txt)» — пересборка отменена.")

    out = src[:src.index("<diagram ")] + "\n".join(plan) + "\n" + build_page(
        levels, meta) + "\n</mxfile>"
    with open(DST, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)
    print("Готово:", DST, "· страниц:", len(plan) + 1)


if __name__ == "__main__":
    main()
