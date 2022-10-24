import { arrayFindIndex } from 'element-ui/src/utils/util';
import { getCell, getColumnByCell, getRowIdentity } from './util';
import { getStyle, hasClass, removeClass, addClass } from 'element-ui/src/utils/dom';
import ElCheckbox from 'element-ui/packages/checkbox';
import ElTooltip from 'element-ui/packages/tooltip';
import debounce from 'throttle-debounce/debounce';
import LayoutObserver from './layout-observer';
import { mapStates } from './store/helper';
import TableRow from './table-row.js';

export default {
  name: 'ElTableBody',

  mixins: [LayoutObserver],

  components: {
    ElCheckbox,
    ElTooltip,
    TableRow
  },

  props: {
    store: {
      required: true
    },
    stripe: Boolean,
    context: {},
    rowClassName: [String, Function],
    rowStyle: [Object, Function],
    fixed: String,
    highlight: Boolean,
    useCutBack: Boolean,
    useMemo: Boolean
  },

  render(h) {
    const data = this.data || [];
    const { store, hasExpandColumn, columnsCount, table, treeIndent, columns, firstDefaultColumnIndex,
      context, columnsHidden, fixed, stripe, useCutBack, useMemo } = this;
    const that = { store, hasExpandColumn, columnsCount, table, treeIndent, columns, firstDefaultColumnIndex,
      context, columnsHidden, fixed, stripe, useCutBack, useMemo };

    return (
      <table
        class="el-table__body"
        cellspacing="0"
        cellpadding="0"
        border="0">
        <colgroup>
          {
            this.columns.map(column => <col name={column.id} key={column.id} />)
          }
        </colgroup>
        <tbody>
          {
            data.reduce((acc, row) => {
              return acc.concat(this.wrappedRowRender(row, acc.length, that));
            }, [])
          }
          <el-tooltip effect={this.table.tooltipEffect} placement="top" ref="tooltip" content={this.tooltipContent}></el-tooltip>
        </tbody>
      </table>
    );
  },

  computed: {
    table() {
      return this.$parent;
    },

    ...mapStates({
      data: 'data',
      columns: 'columns',
      treeIndent: 'indent',
      leftFixedLeafCount: 'fixedLeafColumnsLength',
      rightFixedLeafCount: 'rightFixedLeafColumnsLength',
      columnsCount: states => states.columns.length,
      leftFixedCount: states => states.fixedColumns.length,
      rightFixedCount: states => states.rightFixedColumns.length,
      hasExpandColumn: states => states.columns.some(({ type }) => type === 'expand')
    }),

    columnsHidden() {
      return this.columns.map((column, index) => this.isColumnHidden(index));
    },

    firstDefaultColumnIndex() {
      return arrayFindIndex(this.columns, ({ type }) => type === 'default');
    }
  },

  watch: {
    // don't trigger getter of currentRow in getCellClass. see https://jsfiddle.net/oe2b4hqt/
    // update DOM manually. see https://github.com/ElemeFE/element/pull/13954/files#diff-9b450c00d0a9dec0ffad5a3176972e40
    'store.states.hoverRow'(newVal, oldVal) {
      if (!this.store.states.isComplex || this.$isServer) return;
      let raf = window.requestAnimationFrame;
      if (!raf) {
        raf = (fn) => setTimeout(fn, 16);
      }
      raf(() => {
        const rows = this.$el.querySelectorAll('.el-table__row');
        const oldRow = rows[oldVal];
        const newRow = rows[newVal];
        if (oldRow) {
          removeClass(oldRow, 'hover-row');
        }
        if (newRow) {
          addClass(newRow, 'hover-row');
        }
      });
    },
    'store.states.data'() {
      this.$vnodeCache = [];
    },
    'store.states.columns': {
      deep: true,
      handler() {
        this.$vnodeCache = [];
      }
    }
  },

  data() {
    return {
      tooltipContent: ''
    };
  },

  created() {
    this.activateTooltip = debounce(50, tooltip => tooltip.handleShowPopper());
    this.$vnodeCache = [];
  },

  methods: {
    getKeyOfRow(row, index, that) {
      const rowKey = that.table.rowKey;
      if (rowKey) {
        return getRowIdentity(row, rowKey);
      }
      return index;
    },

    isColumnHidden(index) {
      if (this.fixed === true || this.fixed === 'left') {
        return index >= this.leftFixedLeafCount;
      } else if (this.fixed === 'right') {
        return index < this.columnsCount - this.rightFixedLeafCount;
      } else {
        return (index < this.leftFixedLeafCount) || (index >= this.columnsCount - this.rightFixedLeafCount);
      }
    },

    getSpan(row, column, rowIndex, columnIndex) {
      let rowspan = 1;
      let colspan = 1;
      const fn = this.table.spanMethod;
      if (typeof fn === 'function') {
        const result = fn({
          row,
          column,
          rowIndex,
          columnIndex
        });
        if (Array.isArray(result)) {
          rowspan = result[0];
          colspan = result[1];
        } else if (typeof result === 'object') {
          rowspan = result.rowspan;
          colspan = result.colspan;
        }
      }
      return { rowspan, colspan };
    },

    getRowStyle(row, rowIndex, that) {
      const rowStyle = that.table.rowStyle;
      if (typeof rowStyle === 'function') {
        return rowStyle.call(null, {
          row,
          rowIndex
        });
      }
      return rowStyle || null;
    },

    getRowClass(row, rowIndex, that) {
      const classes = ['el-table__row'];
      if (that.table.highlightCurrentRow && row === that.store.states.currentRow) {
        classes.push('current-row');
      }

      if (that.stripe && rowIndex % 2 === 1) {
        classes.push('el-table__row--striped');
      }
      const rowClassName = that.table.rowClassName;
      if (typeof rowClassName === 'string') {
        classes.push(rowClassName);
      } else if (typeof rowClassName === 'function') {
        classes.push(rowClassName.call(null, {
          row,
          rowIndex
        }));
      }

      if (that.store.states.expandRows.indexOf(row) > -1) {
        classes.push('expanded');
      }

      return classes;
    },

    getCellStyle(rowIndex, columnIndex, row, column) {
      const cellStyle = this.table.cellStyle;
      if (typeof cellStyle === 'function') {
        return cellStyle.call(null, {
          rowIndex,
          columnIndex,
          row,
          column
        });
      }
      return cellStyle;
    },

    getCellClass(rowIndex, columnIndex, row, column) {
      const classes = [column.id, column.align, column.className];

      if (this.isColumnHidden(columnIndex)) {
        classes.push('is-hidden');
      }

      const cellClassName = this.table.cellClassName;
      if (typeof cellClassName === 'string') {
        classes.push(cellClassName);
      } else if (typeof cellClassName === 'function') {
        classes.push(cellClassName.call(null, {
          rowIndex,
          columnIndex,
          row,
          column
        }));
      }

      classes.push('el-table__cell');

      return classes.join(' ');
    },

    getColspanRealWidth(columns, colspan, index) {
      if (colspan < 1) {
        return columns[index].realWidth;
      }
      const widthArr = columns.map(({ realWidth }) => realWidth).slice(index, index + colspan);
      return widthArr.reduce((acc, width) => acc + width, -1);
    },

    handleCellMouseEnter(event, row) {
      const table = this.table;
      const cell = getCell(event);

      if (cell) {
        const column = getColumnByCell(table, cell);
        const hoverState = table.hoverState = { cell, column, row };
        table.$emit('cell-mouse-enter', hoverState.row, hoverState.column, hoverState.cell, event);
      }

      // 判断是否text-overflow, 如果是就显示tooltip
      const cellChild = event.target.querySelector('.cell');
      if (!(hasClass(cellChild, 'el-tooltip') && cellChild.childNodes.length)) {
        return;
      }
      // use range width instead of scrollWidth to determine whether the text is overflowing
      // to address a potential FireFox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1074543#c3
      const range = document.createRange();
      range.setStart(cellChild, 0);
      range.setEnd(cellChild, cellChild.childNodes.length);
      const rangeWidth = range.getBoundingClientRect().width;
      const padding = (parseInt(getStyle(cellChild, 'paddingLeft'), 10) || 0) +
        (parseInt(getStyle(cellChild, 'paddingRight'), 10) || 0);
      if ((rangeWidth + padding > cellChild.offsetWidth || cellChild.scrollWidth > cellChild.offsetWidth) && this.$refs.tooltip) {
        const tooltip = this.$refs.tooltip;
        // TODO 会引起整个 Table 的重新渲染，需要优化
        this.tooltipContent = cell.innerText || cell.textContent;
        tooltip.referenceElm = cell;
        tooltip.$refs.popper && (tooltip.$refs.popper.style.display = 'none');
        tooltip.doDestroy();
        tooltip.setExpectedState(true);
        this.activateTooltip(tooltip);
      }
    },

    handleCellMouseLeave(event) {
      const tooltip = this.$refs.tooltip;
      if (tooltip) {
        tooltip.setExpectedState(false);
        tooltip.handleClosePopper();
      }
      const cell = getCell(event);
      if (!cell) return;

      const oldHoverState = this.table.hoverState || {};
      this.table.$emit('cell-mouse-leave', oldHoverState.row, oldHoverState.column, oldHoverState.cell, event);
    },

    handleMouseEnter: debounce(30, function(index) {
      this.store.commit('setHoverRow', index);
    }),

    handleMouseLeave: debounce(30, function() {
      this.store.commit('setHoverRow', null);
    }),

    handleContextMenu(event, row) {
      this.handleEvent(event, row, 'contextmenu');
    },

    handleDoubleClick(event, row) {
      this.handleEvent(event, row, 'dblclick');
    },

    handleClick(event, row) {
      this.store.commit('setCurrentRow', row);
      this.handleEvent(event, row, 'click');
    },

    handleEvent(event, row, name) {
      const table = this.table;
      const cell = getCell(event);
      let column;
      if (cell) {
        column = getColumnByCell(table, cell);
        if (column) {
          table.$emit(`cell-${name}`, row, column, cell, event);
        }
      }
      table.$emit(`row-${name}`, row, column, event);
    },
    isRowSelectionChanged(row, selectionMemo, currentSelection, selectableMemo, currentSelectable) {
      return selectionMemo.indexOf(row) > -1 !== currentSelection.indexOf(row) > -1 || selectableMemo !== currentSelectable;
    },
    rowRender(row, $index, treeRowData, that) {
      const { treeIndent, columns, firstDefaultColumnIndex } = that;
      const rowClasses = this.getRowClass(row, $index, that);
      let display = true;
      if (treeRowData) {
        rowClasses.push('el-table__row--level-' + treeRowData.level);
        display = treeRowData.display;
      }
      // 指令 v-show 会覆盖 row-style 中 display
      // 使用 :style 代替 v-show https://github.com/ElemeFE/element/issues/16995
      let displayStyle = display ? null : {
        display: 'none'
      };

      const key = this.getKeyOfRow(row, $index, that);
      const cached = this.$vnodeCache[key];
      const { selection: currentSelection, selectable, rowKey } = that.store.states;
      const selectableMemo = selectable && selectable.call(null, row, $index);
      if (that.useMemo && rowKey && cached) {
        if (!this.isRowSelectionChanged(row, cached.$selectionMemo, currentSelection, cached.$selectableMemo, selectableMemo)) return cached;
      }
      const selectionMemo = currentSelection.slice();

      const vnode = (
        <TableRow
          style={[displayStyle, this.getRowStyle(row, $index, that)]}
          class={rowClasses}
          key={key}
          nativeOn-dblclick={($event) => this.handleDoubleClick($event, row)}
          nativeOn-click={($event) => this.handleClick($event, row)}
          nativeOn-contextmenu={($event) => this.handleContextMenu($event, row)}
          nativeOn-mouseenter={_ => this.handleMouseEnter($index)}
          nativeOn-mouseleave={this.handleMouseLeave}
          columns={columns}
          row={row}
          index={$index}
          store={that.store}
          context={that.context || that.table.$vnode.context}
          firstDefaultColumnIndex={firstDefaultColumnIndex}
          treeRowData={treeRowData}
          treeIndent={treeIndent}
          columnsHidden={that.columnsHidden}
          getSpan={this.getSpan}
          getColspanRealWidth={this.getColspanRealWidth}
          getCellStyle={this.getCellStyle}
          getCellClass={this.getCellClass}
          handleCellMouseEnter={this.handleCellMouseEnter}
          handleCellMouseLeave={this.handleCellMouseLeave}
          isSelected={that.store.isSelected(row)}
          isExpanded={that.store.states.expandRows.indexOf(row) > -1}
          fixed={that.fixed}
          useCutBack={that.useCutBack}
        >
        </TableRow>
      );

      if (that.useMemo && rowKey && columns.length) {
        vnode.$selectionMemo = selectionMemo;
        vnode.$selectableMemo = selectableMemo;
        this.$vnodeCache[key] = vnode;
      }

      return vnode;
    },

    wrappedRowRender(row, $index, that) {
      const store = that.store;
      const { isRowExpanded, assertRowKey } = store;
      const { treeData, lazyTreeNodeMap, childrenColumnName, rowKey } = store.states;
      if (that.hasExpandColumn && isRowExpanded(row)) {
        const renderExpanded = that.table.renderExpanded;
        const tr = this.rowRender(row, $index, undefined, that);
        if (!renderExpanded) {
          console.error('[Element Error]renderExpanded is required.');
          return tr;
        }
        // 使用二维数组，避免修改 $index
        return [[
          tr,
          <tr key={'expanded-row__' + tr.key}>
            <td colspan={ that.columnsCount } class="el-table__cell el-table__expanded-cell">
              { renderExpanded(this.$createElement, { row, $index, store }) }
            </td>
          </tr>]];
      } else if (Object.keys(treeData).length) {
        assertRowKey();
        // TreeTable 时，rowKey 必须由用户设定，不使用 getKeyOfRow 计算
        // 在调用 rowRender 函数时，仍然会计算 rowKey，不太好的操作
        const key = getRowIdentity(row, rowKey);
        let cur = treeData[key];
        let treeRowData = null;
        if (cur) {
          treeRowData = {
            expanded: cur.expanded,
            level: cur.level,
            display: true
          };
          if (typeof cur.lazy === 'boolean') {
            if (typeof cur.loaded === 'boolean' && cur.loaded) {
              treeRowData.noLazyChildren = !(cur.children && cur.children.length);
            }
            treeRowData.loading = cur.loading;
          }
        }
        const tmp = [this.rowRender(row, $index, treeRowData, that)];
        // 渲染嵌套数据
        if (cur) {
          // currentRow 记录的是 index，所以还需主动增加 TreeTable 的 index
          let i = 0;
          const traverse = (children, parent) => {
            if (!(children && children.length && parent)) return;
            children.forEach(node => {
              // 父节点的 display 状态影响子节点的显示状态
              const innerTreeRowData = {
                display: parent.display && parent.expanded,
                level: parent.level + 1
              };
              const childKey = getRowIdentity(node, rowKey);
              if (childKey === undefined || childKey === null) {
                throw new Error('for nested data item, row-key is required.');
              }
              cur = { ...treeData[childKey] };
              // 对于当前节点，分成有无子节点两种情况。
              // 如果包含子节点的，设置 expanded 属性。
              // 对于它子节点的 display 属性由它本身的 expanded 与 display 共同决定。
              if (cur) {
                innerTreeRowData.expanded = cur.expanded;
                // 懒加载的某些节点，level 未知
                cur.level = cur.level || innerTreeRowData.level;
                cur.display = !!(cur.expanded && innerTreeRowData.display);
                if (typeof cur.lazy === 'boolean') {
                  if (typeof cur.loaded === 'boolean' && cur.loaded) {
                    innerTreeRowData.noLazyChildren = !(cur.children && cur.children.length);
                  }
                  innerTreeRowData.loading = cur.loading;
                }
              }
              i++;
              tmp.push(this.rowRender(node, $index + i, innerTreeRowData, that));
              if (cur) {
                const nodes = lazyTreeNodeMap[childKey] || node[childrenColumnName];
                traverse(nodes, cur);
              }
            });
          };
          // 对于 root 节点，display 一定为 true
          cur.display = true;
          const nodes = lazyTreeNodeMap[key] || row[childrenColumnName];
          traverse(nodes, cur);
        }
        return tmp;
      } else {
        return this.rowRender(row, $index, undefined, that);
      }
    }
  }
};
