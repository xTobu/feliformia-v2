<template>
    <ClientOnly>
        <div v-loading="loading" id="shift">
            <form @submit.prevent="saveNow">
                <!-- 標題靠左；右邊是「‹ 10/19 週日 早班 ›」：箭頭跳前後一班，點中間從下方滑出選擇面板 -->
                <div class="shift-header">
                    <h1>值班記錄表</h1>
                    <div class="shift-nav">
                        <button
                            type="button"
                            class="nav-btn"
                            aria-label="上一班"
                            :disabled="!canGo(prevOf(viewing))"
                            @click="goTo(prevOf(viewing))"
                        >
                            ‹
                        </button>
                        <button type="button" class="current-btn" @click="openPicker">
                            {{ shiftTitle(viewing) }}
                        </button>
                        <button
                            type="button"
                            class="nav-btn"
                            aria-label="下一班"
                            :disabled="!canGo(nextOf(viewing))"
                            @click="goTo(nextOf(viewing))"
                        >
                            ›
                        </button>
                    </div>
                </div>

                <!-- 分頁：依值班的時間順序 -->
                <div class="tabs" role="tablist">
                    <button
                        v-for="t in tabList"
                        :key="t.value"
                        type="button"
                        role="tab"
                        :aria-selected="tab === t.value"
                        :class="{ active: tab === t.value }"
                        @click="setTab(t.value)"
                    >
                        {{ t.label }}
                        <span v-if="t.remaining" class="remaining">{{
                            t.remaining
                        }}</span>
                    </button>
                </div>

                <!-- ========== 觀察：上一班放的飯吃了多少、排泄 ========== -->
                <div v-show="tab === 'arrive'" class="W100">
                    <ShiftReportBlock v-bind="prevBlock('arrive')" />

                    <div
                        v-for="cat in formData.cats"
                        :key="cat.cat_id"
                        class="d_flex record_item intake-card"
                        :class="{ compact: !showIntake(cat) }"
                    >
                        <div class="name-wrap">
                            <div class="name">{{ cat.name }}</div>
                            <!-- 這個分頁、這隻貓的留言。橘點：上一班有交代 -->
                            <button
                                type="button"
                                class="comment-btn"
                                :class="{ has: commentCount(cat.cat_id) }"
                                :aria-label="`${cat.name}的留言`"
                                @click="openComments(cat)"
                            >
                                💬<span v-if="commentCount(cat.cat_id)">{{
                                    commentCount(cat.cat_id)
                                }}</span>
                                <i v-if="hasHandover(cat.cat_id)" class="handover-dot"></i>
                            </button>
                            <!-- 這一班、這隻貓的觀察照片（食物、便便…），點了從下方滑出 -->
                            <button
                                type="button"
                                class="comment-btn"
                                :class="{ has: photoCount(cat.cat_id, 'arrive') }"
                                :aria-label="`${cat.name}的照片`"
                                @click="openPhotos(cat, 'arrive')"
                            >
                                🗂️<span v-if="photoCount(cat.cat_id, 'arrive')">{{
                                    photoCount(cat.cat_id, 'arrive')
                                }}</span>
                            </button>
                        </div>
                        <!-- 上一班放風：貓沒關籠，吃多少、排泄看不出來，預設不登記，卡片只剩一行；
                             有看到的話按「仍要登記」展開。已經填過的會自動展開 -->
                        <div v-if="cat.prev_released" class="released-row">
                            <el-tag type="warning" size="small">上一班放風</el-tag>
                            <!-- 收起時：沒填過寫「仍要登記」，填過寫「已登記」；展開時都可以「收起」 -->
                            <button
                                type="button"
                                class="released-toggle"
                                @click="toggleIntake(cat)"
                            >
                                {{
                                    showIntake(cat)
                                        ? '收起'
                                        : intakeTouched(cat)
                                          ? '已登記 ›'
                                          : '仍要登記 ›'
                                }}
                            </button>
                        </div>
                        <div v-if="showIntake(cat)" class="detail intake">
                            <!-- 食物 - 乾 -->
                            <div class="feed food d_flex">
                                <p class="f_blue">食物</p>
                                <div class="d_flex">
                                    <el-checkbox
                                        v-model="cat.intake.feed"
                                        :disabled="isDisabled"
                                        @change="
                                            foodHandler(cat, 'feed');
                                            saveIntake(cat);
                                        "
                                        >乾</el-checkbox
                                    >
                                    <el-slider
                                        v-model="cat.intake.feed_detail"
                                        :step="25"
                                        :marks="marks"
                                        :show-tooltip="false"
                                        :disabled="isDisabled || !cat.intake.feed"
                                        @change="saveIntake(cat)"
                                    />
                                </div>
                            </div>

                            <!-- 食物 - 罐 -->
                            <div class="can food d_flex">
                                <p class="f_blue"></p>
                                <div class="d_flex">
                                    <el-checkbox
                                        v-model="cat.intake.can"
                                        :disabled="isDisabled"
                                        @change="
                                            foodHandler(cat, 'can');
                                            saveIntake(cat);
                                        "
                                        >罐</el-checkbox
                                    >
                                    <el-slider
                                        v-model="cat.intake.can_detail"
                                        :step="25"
                                        :marks="marks"
                                        :show-tooltip="false"
                                        :disabled="isDisabled || !cat.intake.can"
                                        @change="saveIntake(cat)"
                                    />
                                </div>
                            </div>

                            <!-- 排泄 -->
                            <div class="excretion d_flex">
                                <p class="f_blue">排泄</p>
                                <div class="d_flex">
                                    <div class="W40 d_flex">
                                        <el-checkbox
                                            v-model="cat.intake.urine"
                                            :disabled="isDisabled"
                                            @change="saveIntake(cat)"
                                            >尿</el-checkbox
                                        >
                                        <el-checkbox
                                            v-model="cat.intake.feces"
                                            :disabled="isDisabled"
                                            @change="
                                                fecesHandler(cat);
                                                saveIntake(cat);
                                            "
                                            >便</el-checkbox
                                        >
                                    </div>
                                    <div class="W60 d_flex">
                                        <el-radio-group
                                            v-model="cat.intake.feces_warning"
                                            :disabled="isDisabled || !cat.intake.feces"
                                            @change="saveIntake(cat)"
                                        >
                                            <el-radio value="正常">正常</el-radio>
                                            <el-radio value="軟便">軟便</el-radio>
                                            <el-radio value="拉稀">拉稀</el-radio>
                                        </el-radio-group>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ========== 醫療：醫療管理的項目（醫療、餵藥、外用），只列有事項的貓 ========== -->
                <template v-for="section in medicalSections" :key="section.tab">
                    <div v-show="tab === section.tab" class="W100">
                        <ShiftReportBlock v-bind="prevBlock(section.tab)" />
                        <!-- 兩區都有時各加小標題：貓咪／全員與位置（同後台） -->
                        <div v-if="section.cats.length && section.taskGroups.length" class="section-title">
                            貓咪
                        </div>
                        <div
                            v-for="entry in section.cats"
                            :key="entry.cat.cat_id"
                            class="d_flex record_item"
                        >
                            <div class="name-wrap">
                                <div class="name">{{ entry.cat.name }}</div>
                                <!-- 這個分頁、這隻貓的留言。橘點：上一班有交代 -->
                                <button
                                    type="button"
                                    class="comment-btn"
                                    :class="{ has: commentCount(entry.cat.cat_id) }"
                                    :aria-label="`${entry.cat.name}的留言`"
                                    @click="openComments(entry.cat)"
                                >
                                    💬<span v-if="commentCount(entry.cat.cat_id)">{{
                                        commentCount(entry.cat.cat_id)
                                    }}</span>
                                    <i v-if="hasHandover(entry.cat.cat_id)" class="handover-dot"></i>
                                </button>
                                <!-- 這一班、這隻貓的醫療照片（傷口、病情…） -->
                                <button
                                    type="button"
                                    class="comment-btn"
                                    :class="{ has: photoCount(entry.cat.cat_id, 'care') }"
                                    :aria-label="`${entry.cat.name}的醫療照片`"
                                    @click="openPhotos(entry.cat, 'care')"
                                >
                                    🗂️<span v-if="photoCount(entry.cat.cat_id, 'care')">{{
                                        photoCount(entry.cat.cat_id, 'care')
                                    }}</span>
                                </button>
                            </div>
                            <div class="detail">
                                <div
                                    v-for="(item, index) in entry.items"
                                    :key="item.id"
                                    class="d_flex item-row"
                                    :class="{ divided: index > 0 }"
                                >
                                    <p class="f_blue">{{ item.category || '事項' }}</p>
                                    <div class="d_flex">
                                        <div class="txt">
                                            <font class="treatment">{{ item.treatment }}</font>
                                            <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                            <font v-if="item.end_date" class="f_grey"
                                                >療程至 {{ $dayjs(item.end_date).format('MM/DD') }}</font
                                            >
                                            <font v-if="item.done && item.done_by" class="done-by"
                                                >✓ {{ doneLabel(item) }}</font
                                            >
                                        </div>
                                        <div class="done">
                                            <el-checkbox
                                                v-model="item.done"
                                                :disabled="isDisabled"
                                                @change="
                                                    stampDone(item);
                                                    saveCatItem(entry.cat, 'medical', item);
                                                "
                                                >完成</el-checkbox
                                            >
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="section.cats.length && section.taskGroups.length" class="section-title later">
                            全員與位置
                        </div>

                        <!-- 不屬於單一貓咪的項目（全員、某個位置） -->
                        <div
                            v-for="group in section.taskGroups"
                            :key="group.name"
                            class="d_flex record_item"
                        >
                            <div class="name">{{ group.name }}</div>
                            <div class="detail">
                                <div
                                    v-for="(item, index) in group.items"
                                    :key="item.key"
                                    class="d_flex item-row"
                                    :class="{ divided: index > 0 }"
                                >
                                    <p class="f_blue">{{ item.category || '事項' }}</p>
                                    <div class="d_flex">
                                        <div class="txt">
                                            <font class="treatment">{{ item.treatment }}</font>
                                            <font v-if="item.reason" class="f_grey">{{ item.reason }}</font>
                                            <font v-if="item.done && item.done_by" class="done-by"
                                                >✓ {{ doneLabel(item) }}</font
                                            >
                                        </div>
                                        <div class="done">
                                            <el-checkbox
                                                v-model="item.done"
                                                :disabled="isDisabled"
                                                @change="
                                                    stampDone(item);
                                                    saveTask(item);
                                                "
                                                >完成</el-checkbox
                                            >
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <el-empty
                            v-if="section.cats.length === 0 && section.taskGroups.length === 0"
                            :description="section.empty"
                        />
                    </div>
                </template>

                <!-- ========== 備餐：乾乾、罐罐、隨餐藥、補充品、放風、其他，放風按鈕。全員／位置的飲食併進適用的貓 ========== -->
                <div v-show="tab === 'meal'" class="W100">
                    <ShiftReportBlock v-bind="prevBlock('meal')" />
                    <div
                        v-for="entry in leaveCats"
                        :key="entry.cat.cat_id"
                        class="d_flex record_item"
                    >
                        <div class="name-wrap">
                            <div class="name">{{ entry.cat.name }}</div>
                            <!-- 這個分頁、這隻貓的留言。橘點：上一班有交代 -->
                            <button
                                type="button"
                                class="comment-btn"
                                :class="{ has: commentCount(entry.cat.cat_id) }"
                                :aria-label="`${entry.cat.name}的留言`"
                                @click="openComments(entry.cat)"
                            >
                                💬<span v-if="commentCount(entry.cat.cat_id)">{{
                                    commentCount(entry.cat.cat_id)
                                }}</span>
                                <i v-if="hasHandover(entry.cat.cat_id)" class="handover-dot"></i>
                            </button>
                        </div>
                        <!-- 放風：離開時沒有關籠，下一班在觀察分頁會看到。貓名同一列最右邊的膠囊按鈕 -->
                        <button
                            type="button"
                            class="release-pill"
                            :class="{ on: entry.cat.released }"
                            :aria-pressed="entry.cat.released"
                            :disabled="isDisabled"
                            @click="toggleReleased(entry.cat)"
                        >
                            {{ entry.cat.released ? '✓ 放風' : '放風' }}
                        </button>
                        <div class="detail">
                            <!-- 乾乾、罐罐、補充品、放風、其他：只看不打勾；隨餐藥（拌進飯裡）要打勾。
                                 同類別併成一列，全員／位置的標出來源 -->
                            <div
                                v-for="(row, index) in entry.dietRows"
                                :key="row.category"
                                class="d_flex item-row diet-row"
                                :class="{ divided: index > 0 }"
                            >
                                <p class="f_blue">{{ row.category }}</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <!-- 文字一律齊左；全員／位置的來源標籤靠右成一欄 -->
                                        <!-- 同一類別有兩項以上時加序號，才分得出是兩項還是一項換行 -->
                                        <div v-for="(it, n) in row.items" :key="it.key" class="diet-item">
                                            <div class="diet-line">
                                                <span v-if="row.items.length > 1" class="diet-no">{{ n + 1 }}.</span>
                                                <span class="diet-text">{{ it.item.content }}</span>
                                                <span v-if="it.source" class="source-chip">{{
                                                    it.source
                                                }}</span>
                                                <el-checkbox
                                                    v-if="isMealMed(it.item)"
                                                    v-model="it.item.done"
                                                    class="diet-done"
                                                    :disabled="isDisabled"
                                                    @change="
                                                        stampDone(it.item);
                                                        saveDietItem(entry.cat, it);
                                                    "
                                                    >完成</el-checkbox
                                                >
                                            </div>
                                            <div v-if="it.item.done && it.item.done_by" class="diet-note done-by">
                                                ✓ {{ doneLabel(it.item) }}
                                            </div>
                                            <div v-if="it.item.end_date" class="diet-note">
                                                至 {{ $dayjs(it.item.end_date).format('MM/DD') }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="entry.dietRows.length === 0" class="d_flex item-row diet-row">
                                <p class="f_blue">飲食</p>
                                <div class="d_flex">
                                    <div class="txt full">
                                        <font class="f_grey">尚未設定飲食</font>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- ========== 收尾：這一班離開前一定要勾完的清單（備餐右邊）。
                     對象可以是某隻貓、全員、貓屋或某個位置，每一項都是整班勾一次 ========== -->
                <div v-show="tab === 'required'" class="W100">
                    <ShiftReportBlock v-bind="prevBlock('required')" />

                    <div v-if="requiredCats.length && requiredGroups.length" class="section-title">
                        貓咪
                    </div>
                    <div
                        v-for="entry in requiredCats"
                        :key="entry.cat.cat_id"
                        class="d_flex record_item required-card"
                    >
                        <div class="name-wrap">
                            <div class="name">{{ entry.cat.name }}</div>
                            <!-- 這個分頁、這隻貓的留言。橘點：上一班有交代 -->
                            <button
                                type="button"
                                class="comment-btn"
                                :class="{ has: commentCount(entry.cat.cat_id) }"
                                :aria-label="`${entry.cat.name}的留言`"
                                @click="openComments(entry.cat)"
                            >
                                💬<span v-if="commentCount(entry.cat.cat_id)">{{
                                    commentCount(entry.cat.cat_id)
                                }}</span>
                                <i v-if="hasHandover(entry.cat.cat_id)" class="handover-dot"></i>
                            </button>
                        </div>
                        <div class="detail">
                            <div
                                v-for="(item, index) in entry.items"
                                :key="item.key"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="treatment">{{ item.content }}</font>
                                        <font v-if="item.done && item.done_by" class="done-by"
                                            >✓ {{ doneLabel(item) }}</font
                                        >
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="item.done"
                                            :disabled="isDisabled"
                                            @change="
                                                stampDone(item);
                                                saveTask(item);
                                            "
                                            >完成</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="requiredCats.length && requiredGroups.length" class="section-title later">
                        全員與位置
                    </div>
                    <!-- 全員 → 貓屋 → 位置 -->
                    <div
                        v-for="group in requiredGroups"
                        :key="group.name"
                        class="d_flex record_item required-card"
                    >
                        <div class="name">{{ group.name }}</div>
                        <div class="detail">
                            <div
                                v-for="(item, index) in group.items"
                                :key="item.key"
                                class="d_flex item-row"
                                :class="{ divided: index > 0 }"
                            >
                                <div class="d_flex">
                                    <div class="txt">
                                        <font class="treatment">{{ item.content }}</font>
                                        <font v-if="item.done && item.done_by" class="done-by"
                                            >✓ {{ doneLabel(item) }}</font
                                        >
                                    </div>
                                    <div class="done">
                                        <el-checkbox
                                            v-model="item.done"
                                            :disabled="isDisabled"
                                            @change="
                                                stampDone(item);
                                                saveTask(item);
                                            "
                                            >完成</el-checkbox
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <el-empty
                        v-if="requiredCats.length === 0 && requiredGroups.length === 0"
                        description="這一班沒有收尾項目"
                    />
                </div>

                <!-- ========== 回報：每個分頁、每個人各一段（用登入身分）。下一班在同一個分頁上方看得到 ========== -->
                <div class="W100 mb20 report">
                    <!-- 跟上面的貓咪、項目分開：小標題＋細線 -->
                    <div class="section-title report-title">回報</div>
                    <ShiftReportBlock
                        :title="`其他人的${tabLabel}回報`"
                        :entries="othersEntries"
                        :storage-key="`now:${tab}`"
                    />
                    <!-- 我的回報：標題、輸入框、儲存列收在同一張卡片 -->
                    <div class="my-report">
                        <div class="mr-head">
                            <span class="mr-title">我的{{ tabLabel }}回報</span>
                        </div>
                        <el-input
                            type="textarea"
                            v-model="drafts[tab]"
                            :disabled="isDisabled"
                            :autosize="{ minRows: 3, maxRows: 12 }"
                            placeholder="寫給下一班…"
                            @input="saveReport(tab)"
                        />
                        <!-- 改完會自動儲存；按鈕讓人確定有存到，失敗時也在這裡重試 -->
                        <div class="mr-foot">
                            <span class="save-hint" :class="[saveStatus, { saved: saveHint.startsWith('✓') }]">{{
                                saveHint
                            }}</span>
                            <button
                                type="submit"
                                class="save-btn"
                                :disabled="isDisabled || saveStatus === 'saving'"
                            >
                                {{ saveStatus === 'saving' ? '儲存中…' : '儲存' }}
                            </button>
                        </div>
                    </div>

                    <!-- 把這個分頁的回報推到 LINE 群組（每個分頁各發各的，不合在一起） -->
                    <button
                        type="button"
                        class="btn line-green"
                        v-show="!isDisabled"
                        @click="sendTabToLine"
                    >
                        {{ loadingNotify ? '發送中…' : 'LINE 發送至群組' }}
                    </button>
                </div>

                <!-- ========== 每個分頁共用：儲存狀態、連結 ========== -->
                <div class="W100">
                    <div class="d_flex space-between">
                        <p class="last-update">
                            即時更新：{{
                                lastUpdatedAt
                                    ? $dayjs(lastUpdatedAt).format('HH:mm:ss')
                                    : ''
                            }}
                        </p>
                        <p class="last-saved">
                            成功儲存：{{
                                lastSavedAt
                                    ? $dayjs(lastSavedAt).format('HH:mm:ss')
                                    : '尚無變更'
                            }}
                        </p>
                    </div>

                    <NuxtLink class="f_red" to="/shift">回到現在這一班</NuxtLink>
                </div>
            </form>

            <!-- 選擇要看的班：從下方滑出。快速前往一鍵就到；其他日期用手機內建的日期選擇器（不會跳鍵盤） -->
            <el-drawer
                v-model="pickerOpen"
                direction="btt"
                size="auto"
                :with-header="false"
                class="shift-picker-drawer"
            >
                <div class="sp-head">
                    <span class="sp-title">選擇要看的班</span>
                    <button type="button" class="sp-close" aria-label="關閉" @click="pickerOpen = false">
                        ✕
                    </button>
                </div>

                <div class="sp-label">快速前往</div>
                <div class="sp-chips">
                    <button
                        v-for="item in quickShifts"
                        :key="`${item.date}-${item.shift}`"
                        type="button"
                        class="sp-chip"
                        :class="{ on: sameShift(item, viewing) }"
                        @click="goTo(item)"
                    >
                        {{ item.label }}
                    </button>
                </div>

                <div class="sp-label">日期</div>
                <input
                    v-model="pick.date"
                    type="date"
                    class="sp-date"
                    :min="minDate"
                    :max="todayStr()"
                    @change="onPickDate"
                />

                <div class="sp-label">班別</div>
                <div class="sp-seg">
                    <button
                        type="button"
                        :class="{ on: pick.shift === 'morning' }"
                        @click="pick.shift = 'morning'"
                    >
                        早班
                    </button>
                    <button
                        type="button"
                        :class="{ on: pick.shift === 'night' }"
                        :disabled="nightLocked(pick.date)"
                        @click="pick.shift = 'night'"
                    >
                        {{ nightLocked(pick.date) ? '晚班（18:00 後）' : '晚班' }}
                    </button>
                </div>

                <button
                    type="button"
                    class="sp-go"
                    :disabled="!canGo(pick)"
                    @click="goTo(pick)"
                >
                    前往
                </button>
            </el-drawer>

            <!-- 照片面板：從下方滑出，這隻貓、這個分頁（觀察或醫療）的照片，照班分組往上看。點縮圖全螢幕看，可左右滑 -->
            <el-drawer
                v-model="photoOpen"
                direction="btt"
                size="72%"
                :with-header="false"
                class="comment-drawer"
            >
                <div class="cd-head">
                    <span class="cd-title">{{ photoCat?.name }}</span>
                    <span v-if="selecting" class="cd-tab">已選 {{ selectedIds.length }} 張</span>
                    <span v-else class="cd-tab">{{ TAB_LABELS[photoTab] }}照片 · {{ drawerPhotos.length }} 張</span>
                    <!-- 選取模式：一次刪多張。只能選自己傳的（管理員可選全部） -->
                    <template v-if="!drawerPending.length && deletablePhotos.length">
                        <button v-if="selecting" type="button" class="cd-link" @click="toggleSelectAll">
                            {{ allSelected ? '取消全選' : '全選' }}
                        </button>
                        <button type="button" class="cd-link" @click="toggleSelectMode">
                            {{ selecting ? '完成' : '選取' }}
                        </button>
                    </template>
                    <button
                        type="button"
                        class="cd-close"
                        :class="{ 'after-link': !drawerPending.length && deletablePhotos.length }"
                        aria-label="關閉"
                        @click="photoOpen = false"
                    >
                        ✕
                    </button>
                </div>

                <!-- 類型篩選（可多選）：只看有這些類型的照片（例如貓砂），往上滑也只找這些 -->
                <div v-if="!drawerPending.length && photoKindList.length" class="pd-filter">
                    <button
                        type="button"
                        class="pp-kind"
                        :class="{ on: !photoKindFilter.length }"
                        :aria-pressed="!photoKindFilter.length"
                        @click="photoKindFilter = []"
                    >
                        全部
                    </button>
                    <button
                        v-for="kind in photoKindList"
                        :key="kind"
                        type="button"
                        class="pp-kind"
                        :class="{ on: photoKindFilter.includes(kind) }"
                        :aria-pressed="photoKindFilter.includes(kind)"
                        @click="photoKindFilter = toggleKind(photoKindFilter, kind)"
                    >
                        {{ kind }}
                    </button>
                </div>

                <!-- 上傳中的整體進度：固定在標題列下面，不用滑到每張照片才看得到 -->
                <div v-if="isUploading" class="pu-progress">
                    <div class="pu-text">
                        <span>上傳中 {{ uploadedCount }}/{{ uploadBatch.length }} 張</span>
                        <b>{{ uploadPercent }}%</b>
                    </div>
                    <div class="pu-bar"><i :style="{ width: `${uploadPercent}%` }"></i></div>
                </div>

                <!-- 選好照片後先預覽：每張照片滿版、描述在正下方，往下滑看下一張；點圖全螢幕看。
                     每張可以寫描述或取消選取，按「上傳」才開始傳 -->
                <div v-if="drawerPending.length" class="cd-list">
                    <div v-if="!isUploading" class="cd-section">
                        <template v-if="failedCount">{{ failedCount }} 張上傳失敗</template>
                        <template v-else
                            >準備上傳 {{ drawerPending.length }} 張<template v-if="pendingPastLabel"
                                >到 {{ pendingPastLabel }}</template
                            ></template
                        >
                    </div>
                    <div v-for="(item, index) in drawerPending" :key="item.key" class="pp-item">
                        <div class="pp-stage">
                            <el-image
                                class="pp-image"
                                :src="item.previewUrl"
                                fit="contain"
                                :preview-src-list="drawerPending.map((p) => p.previewUrl)"
                                :initial-index="index"
                                preview-teleported
                                hide-on-click-modal
                            />
                            <!-- 按了上傳之後，每張蓋上自己的狀態：排隊中、壓縮中、上傳中、✓ 完成、失敗可重試 -->
                            <div v-if="item.status !== 'idle'" class="pp-status" :class="item.status">
                                <span>
                                    {{ STATUS_TEXT[item.status] }}
                                    <b v-if="['compressing', 'uploading', 'saving'].includes(item.status)"
                                        >{{ item.progress }}%</b
                                    >
                                </span>
                                <span
                                    v-if="['compressing', 'uploading', 'saving'].includes(item.status)"
                                    class="pp-bar"
                                ><i :style="{ width: `${item.progress}%` }"></i></span>
                                <button
                                    v-if="item.status === 'error'"
                                    type="button"
                                    class="pp-retry"
                                    @click="retryUpload(item)"
                                >
                                    重試
                                </button>
                            </div>
                            <!-- 取消選取這一張（其他張還在）；全部不要就按下面的「取消」 -->
                            <button
                                v-if="item.status === 'idle' || item.status === 'error'"
                                type="button"
                                class="pp-remove"
                                aria-label="取消選取這張"
                                @click="removePending(item)"
                            >
                                ✕
                            </button>
                        </div>
                        <!-- 類型（選填、可多選）：點一下選、再點一下取消 -->
                        <div class="pp-kinds">
                            <button
                                v-for="kind in PHOTO_KINDS[item.tab] || []"
                                :key="kind"
                                type="button"
                                class="pp-kind"
                                :class="{ on: item.kinds.includes(kind) }"
                                :aria-pressed="item.kinds.includes(kind)"
                                :disabled="item.status !== 'idle' && item.status !== 'error'"
                                @click="item.kinds = toggleKind(item.kinds, kind)"
                            >
                                {{ kind }}
                            </button>
                        </div>
                        <el-input
                            v-model="item.note"
                            :disabled="item.status !== 'idle' && item.status !== 'error'"
                            class="pp-note"
                            type="textarea"
                            :autosize="{ minRows: 2, maxRows: 4 }"
                            maxlength="500"
                            placeholder="描述（選填）"
                        />
                    </div>
                </div>

                <!-- 照片牆：照班分組，跟留言頻道一樣跨班往上看（打開時是這一班加前面 4 班，捲到最上面再往前 5 班）。
                     每一班都有分隔線（沒照片的班也是，看得出滑到哪一天、也能補傳）；這一班是藍色 -->
                <div v-else ref="photoListEl" class="cd-list" @scroll="onPhotoScroll">
                    <div v-if="historyLoading" class="pd-hint">載入更早的照片…</div>
                    <div v-else-if="historyHasMore" class="pd-hint">往上滑看更早的班</div>
                    <!-- 更早已經沒有任何班的紀錄（新版值班記錄表開始用之前） -->
                    <div v-else-if="historyShifts.length" class="pd-hint">已經是最早的班了</div>
                    <template v-for="group in drawerGroups" :key="group.key">
                        <div class="pd-divider" :class="{ current: group.isCurrent }" :data-shift="group.key">
                            {{ shiftLabel(group) }}
                            <!-- 以前的班也可以補傳照片（還能編輯的班才有） -->
                            <button
                                v-if="!group.isCurrent && !selecting && !drawerPending.length && canUploadTo(group)"
                                type="button"
                                class="pd-divider-add"
                                :aria-label="`補傳照片到${shiftLabel(group)}`"
                                @click="pickPhotosFor(group)"
                            >
                                📷
                            </button>
                        </div>
                        <div v-if="group.photos.length" class="pd-grid">
                            <div v-for="photo in group.photos" :key="photo.id" class="pd-item">
                                <button
                                    v-if="selecting"
                                    type="button"
                                    class="pd-thumb pd-selectable"
                                    :class="{
                                        selected: selectedIds.includes(photo.id),
                                        locked: !canDeletePhoto(photo),
                                    }"
                                    :disabled="!canDeletePhoto(photo)"
                                    :aria-pressed="selectedIds.includes(photo.id)"
                                    @click="toggleSelect(photo)"
                                >
                                    <img :src="photo.thumb_url" alt="" />
                                    <span class="pd-check">✓</span>
                                </button>
                                <!-- 點了看大圖（PhotoViewer：下面有哪一班、誰、類型、描述，可以左右換張） -->
                                <button
                                    v-else
                                    type="button"
                                    class="pd-thumb pd-open"
                                    :aria-label="`看大圖：${photo.note || ''}`"
                                    @click="openPhotoViewer(photo)"
                                >
                                    <img :src="photo.thumb_url" alt="" loading="lazy" />
                                </button>
                                <!-- 類型：縮圖左上角的小標籤 -->
                                <span v-if="photo.kinds?.length" class="pd-kind">{{ photo.kinds.join('・') }}</span>
                                <div class="pd-meta">
                                    {{ photo.author_name || '未命名' }} {{ photoTime(photo, group) }}
                                </div>
                                <div v-if="photo.note" class="pd-note">{{ photo.note }}</div>
                                <!-- 上傳的人或管理員：編輯類型、描述，或刪除照片 -->
                                <button
                                    v-if="canDeletePhoto(photo) && !selecting"
                                    type="button"
                                    class="pd-edit"
                                    @click="editPhoto(photo)"
                                >
                                    ✎ 編輯
                                </button>
                                <button
                                    v-if="canDeletePhoto(photo) && !selecting"
                                    type="button"
                                    class="pd-del"
                                    aria-label="刪除這張照片"
                                    @click="deletePhoto(photo)"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div v-else class="pd-none">
                            {{ group.isCurrent ? '這一班' : '這班' }}{{
                                photoKindFilter.length ? `沒有${photoKindFilter.join('、')}照片` : '還沒有照片'
                            }}
                        </div>
                    </template>
                </div>

                <div class="cd-input">
                    <!-- 不加 capture：手機會讓人選要拍照還是從相簿選，可以一次選多張 -->
                    <input
                        ref="photoInput"
                        type="file"
                        accept="image/*"
                        multiple
                        class="pd-file"
                        @change="onPickPhotos"
                    />
                    <div v-if="selecting" class="pd-confirm">
                        <button type="button" class="pd-cancel" @click="toggleSelectMode">取消</button>
                        <button
                            type="button"
                            class="pd-add pd-danger"
                            :disabled="!selectedIds.length || deleting"
                            @click="deleteSelected"
                        >
                            {{ deleting ? '刪除中…' : `刪除 ${selectedIds.length} 張` }}
                        </button>
                    </div>
                    <button v-else-if="isUploading" type="button" class="pd-add" disabled>
                        上傳中 {{ uploadedCount }}/{{ uploadBatch.length }}…
                    </button>
                    <div v-else-if="drawerPending.length" class="pd-confirm">
                        <button type="button" class="pd-cancel" @click="clearPending">取消</button>
                        <button type="button" class="pd-add" @click="uploadPending">
                            {{ failedCount ? `重試 ${failedCount} 張` : `上傳 ${drawerPending.length} 張` }}
                        </button>
                    </div>
                    <button
                        v-else
                        type="button"
                        class="pd-add"
                        :disabled="isDisabled"
                        @click="pickPhotosFor(null)"
                    >
                        📷 拍照或選照片
                    </button>
                </div>
            </el-drawer>

            <!-- 照片牆的看大圖：下面有哪一班、誰傳的、類型、描述；上傳的人或管理員可以直接編輯 -->
            <PhotoViewer v-model:index="photoViewerIndex" :photos="viewerPhotos" @close="photoViewerIndex = null">
                <template #actions="{ photo }">
                    <button v-if="canDeletePhoto(photo.raw)" type="button" @click="editFromViewer(photo.raw)">
                        ✎ 編輯
                    </button>
                </template>
            </PhotoViewer>

            <!-- LINE 發送前的確認：要發的文字＋勾選要附的照片（最多 4 張；文字超過 5000 字會提醒並可以編輯） -->
            <el-dialog
                :model-value="!!linePush"
                title="發送至 LINE 群組"
                width="90%"
                class="line-push-dialog"
                align-center
                append-to-body
                @update:model-value="(v) => !v && closeLinePush(null)"
            >
                <template v-if="linePush">
                    <div v-if="linePush.editing || linePushBudget.chunks > 1" class="lp-warn">
                        <template v-if="linePushBudget.chunks > 1">
                            內容有 {{ linePushBudget.length }} 字，超過 LINE 一則 {{ LINE_TEXT_MAX }} 字，會分成
                            {{ linePushBudget.chunks }} 則發送<template v-if="linePush.photos.length"
                                >，照片最多只能附 {{ linePushBudget.room }} 張</template
                            >。<template v-if="linePush.editing">可以直接在下面刪減。</template>
                            <template v-else
                                >可以取消不重要的留言，或
                                <button type="button" class="lp-link" @click="editLinePushText">直接編輯文字</button>
                            </template>
                        </template>
                        <template v-else>現在 {{ linePushBudget.length }} 字，一則就發得完。</template>
                    </div>
                    <template v-if="linePush.editing">
                        <el-input
                            v-model="linePush.text"
                            type="textarea"
                            :autosize="{ minRows: 8, maxRows: 14 }"
                            class="lp-textarea"
                        />
                        <button type="button" class="lp-link lp-back" @click="linePush.editing = false">
                            回到勾選留言（手動改的內容會不見）
                        </button>
                    </template>
                    <!-- 換行與縮排都照實際發出去的樣子；留言一則一列，點了切換要不要發 -->
                    <template v-else>
                        <div v-if="linePush.comments.length" class="lp-hint">
                            點留言可以取消，沒勾的不會發出去（{{ linePush.chosen.length }} / {{ linePush.comments.length }}）
                        </div>
                        <div class="lp-text">
                            <div>{{ linePushPreview.head }}</div>
                            <template v-if="linePushPreview.groups.length">
                                <div>{{ linePushPreview.commentsTitle }}</div>
                                <div v-for="(group, i) in linePushPreview.groups" :key="group.catId" :class="{ 'lp-cat-gap': i > 0 }">
                                    <div>{{ group.title }}</div>
                                    <button
                                        v-for="item in group.comments"
                                        :key="item.comment.id"
                                        type="button"
                                        class="lp-pick"
                                        :class="{ off: !linePush.chosen.includes(item.comment.id) }"
                                        role="checkbox"
                                        :aria-checked="linePush.chosen.includes(item.comment.id)"
                                        @click="toggleLineComment(item.comment.id)"
                                    >
                                        <span class="lp-check">{{ linePush.chosen.includes(item.comment.id) ? '✓' : '' }}</span>
                                        <span class="lp-pick-text">{{ item.text }}</span>
                                    </button>
                                </div>
                            </template>
                        </div>
                    </template>

                    <!-- 沒勾的留言，它的照片不會出現在這裡 -->
                    <template v-if="linePushGroups.wall.length || linePushGroups.comments.length">
                        <!-- 跟上面的文字用分隔線隔開，提示可以點照片勾選；預設都不勾 -->
                        <div class="lp-section">
                            <div class="lp-section-title">
                                附上照片
                                <span v-if="linePushBudget.room" class="lp-count"
                                    >{{ linePush.selected.length }} / {{ linePushBudget.room }}</span
                                >
                            </div>
                            <div class="lp-section-hint">
                                <template v-if="linePushBudget.room">
                                    點照片勾選要一起發到群組的，最多 {{ linePushBudget.room }} 張；不勾就只發文字
                                </template>
                                <template v-else>文字太長，這次不能附照片</template>
                            </div>
                        </div>
                        <!-- 照片牆的照片：一張一格，下面寫哪隻貓、誰傳的、類型、描述 -->
                        <template v-if="linePushGroups.wall.length">
                            <div class="lp-sub">🗂️ 照片牆</div>
                            <div class="lp-grid">
                                <div v-for="photo in linePushGroups.wall" :key="photo.id" class="lp-cell">
                                    <button
                                        type="button"
                                        class="lp-photo"
                                        :class="{ on: linePush.selected.includes(photo.id) }"
                                        :disabled="!linePushBudget.room"
                                        :aria-pressed="linePush.selected.includes(photo.id)"
                                        @click="toggleLinePhoto(photo)"
                                    >
                                        <img :src="photo.thumb_url" alt="" />
                                        <span class="lp-mark">{{ linePush.selected.includes(photo.id) ? '✓' : '' }}</span>
                                    </button>
                                    <div class="lp-wall-who">
                                        <b>{{ catNameOf(photo.cat_id) }}</b>・{{ photo.author_name || '未命名' }}
                                        {{ $dayjs(photo.created_at).format('HH:mm') }}
                                    </div>
                                    <div v-if="photo.kinds?.length" class="lp-wall-kinds">
                                        <span v-for="kind in photo.kinds" :key="kind">{{ kind }}</span>
                                    </div>
                                    <div v-if="photo.note" class="lp-wall-note">{{ photo.note }}</div>
                                </div>
                            </div>
                        </template>

                        <!-- 留言附的照片：一則留言一塊（哪隻貓、誰、幾點、說了什麼），下面是那則的照片 -->
                        <template v-if="linePushGroups.comments.length">
                            <div class="lp-sub">💬 留言的照片</div>
                            <div v-for="group in linePushGroups.comments" :key="group.comment.id" class="lp-comment">
                                <div class="lp-comment-head">
                                    <b>{{ catNameOf(group.comment.cat_id) }}</b>
                                    <span>{{ group.comment.author_name || '未命名' }} {{ $dayjs(group.comment.created_at).format('HH:mm') }}</span>
                                    <span v-if="group.comment.for_next" class="lp-important-tag">重要</span>
                                </div>
                                <div class="lp-comment-body">{{ group.comment.body || '（只有照片）' }}</div>
                                <div class="lp-grid">
                                    <button
                                        v-for="photo in group.photos"
                                        :key="photo.id"
                                        type="button"
                                        class="lp-photo"
                                        :class="{ on: linePush.selected.includes(photo.id) }"
                                        :disabled="!linePushBudget.room"
                                        :aria-pressed="linePush.selected.includes(photo.id)"
                                        @click="toggleLinePhoto(photo)"
                                    >
                                        <img :src="photo.thumb_url" alt="" />
                                        <span class="lp-mark">{{ linePush.selected.includes(photo.id) ? '✓' : '' }}</span>
                                    </button>
                                </div>
                            </div>
                        </template>
                    </template>
                </template>
                <template #footer>
                    <div class="pd-confirm">
                        <button type="button" class="pd-cancel" @click="closeLinePush(null)">取消</button>
                        <button type="button" class="pd-add" @click="sendLinePush">發送</button>
                    </div>
                </template>
            </el-dialog>

            <!-- 編輯照片：類型（跟上傳時一樣點標籤、可多選）與描述在同一個視窗，按儲存一起改；也可以刪除這張 -->
            <el-dialog
                :model-value="!!photoEditing"
                title="編輯照片"
                width="90%"
                class="photo-edit-dialog"
                align-center
                append-to-body
                @update:model-value="(v) => !v && (photoEditing = null)"
            >
                <div class="pe-label">類型</div>
                <div class="pp-kinds">
                    <button
                        v-for="kind in PHOTO_KINDS[photoEditing?.tab] || []"
                        :key="kind"
                        type="button"
                        class="pp-kind"
                        :class="{ on: kindDraft.includes(kind) }"
                        :aria-pressed="kindDraft.includes(kind)"
                        @click="kindDraft = toggleKind(kindDraft, kind)"
                    >
                        {{ kind }}
                    </button>
                </div>
                <div class="pe-label">描述</div>
                <el-input
                    v-model="noteDraft"
                    type="textarea"
                    :autosize="{ minRows: 3, maxRows: 6 }"
                    maxlength="500"
                    placeholder="描述（選填）"
                    class="pe-note"
                />
                <button type="button" class="pe-delete" :disabled="savingPhotoEdit" @click="deleteEditingPhoto">
                    刪除這張照片
                </button>
                <template #footer>
                    <div class="pd-confirm">
                        <button type="button" class="pd-cancel" @click="photoEditing = null">取消</button>
                        <button type="button" class="pd-add" :disabled="savingPhotoEdit" @click="savePhotoEdit">
                            {{ savingPhotoEdit ? '儲存中…' : '儲存' }}
                        </button>
                    </div>
                </template>
            </el-dialog>

            <!-- 留言頻道：一隻貓、一個分頁一個頻道，跨班往上看，可以附照片（components/ShiftCommentDrawer.vue） -->
            <ShiftCommentDrawer
                v-model="drawerOpen"
                :cat="drawerCat"
                :tab="tab"
                :tab-label="tabLabel"
                :current="channelCurrent"
                :disabled="isDisabled"
                :me="me"
                @added="onCommentAdded"
                @updated="onCommentUpdated"
                @removed="onCommentRemoved"
            />
        </div>

        <template #fallback>
            <div style="text-align: center; padding: 50px">載入中...</div>
        </template>
    </ClientOnly>
</template>

<script setup>
// 新版值班記錄表：一個班一筆 shifts，合併觀察、醫療、備餐、收尾四個分頁。
// 資料來自新版的 cat_profiles 與飲食／醫療／待辦管理；/regular、/medicine 維持原樣，兩邊不互通。
// 存檔是「局部更新」：每改一格只送那一格（saveIntake、saveCatItem…），
// 兩個人同時改不同的貓或項目不會互相覆蓋
import { ElMessage } from 'element-plus';
import { debounce } from 'lodash-es';
import Swal from 'sweetalert2';

definePageMeta({
    middleware: 'auth',
});

useHead({
    title: '值班記錄表',
});

const { $dayjs } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const supabase = useSupabaseClient();
const { nickname, getUserId, isAdmin } = useProfile();

// State
const loading = ref(true);
const loadingNotify = ref(false);
const saveStatus = ref('success');
const lastUpdatedAt = ref(null);
const lastSavedAt = ref(null);
const tab = ref('arrive');
const prev = ref({ date: null, shift: null, reports: {}, released: [], unfinished: {} });

const marks = {
    0: '沒吃',
    25: '吃1/3',
    50: '吃1/2',
    75: '吃2/3',
    100: '吃光',
};

const formData = ref({
    recordId: '',
    date: new Date(),
    shift: '',
    cats: [], // [{ cat_id, name, location, sort, intake, released, medical: [], diet: [] }]
    tasks: [], // [{ key, kind, id, location, ... }]，kind：medical / diet / required（收尾）
    reports: {}, // { 分頁: { user_id: { name, text, at } } }：每個分頁、每個人一段
});

// 我在每個分頁的回報（輸入框綁這份）
const drafts = ref({});
const me = computed(() => getUserId() || null);

// 一個分頁的回報清單：只留有內容的，照時間排（舊資料沒有時間，排最前面）
function entriesOf(reports, key) {
    return Object.entries(reports?.[key] || {})
        .map(([uid, r]) => ({ key: uid, name: r?.name, text: r?.text || '', at: r?.at || null }))
        .filter((r) => r.text.trim())
        .sort((a, b) => (a.at || '').localeCompare(b.at || ''));
}

// ---- 資料轉換：資料庫存的是以 id 為 key 的物件，畫面用排好順序的陣列 ----
const MAX = Number.MAX_SAFE_INTEGER;
const bySort = (a, b) => (a.sort ?? MAX) - (b.sort ?? MAX);
const sortedValues = (obj) => Object.values(obj || {}).sort(bySort);

function defaultIntake() {
    return {
        feed: true,
        feed_detail: 0,
        can: false,
        can_detail: 0,
        urine: false,
        feces: false,
        feces_warning: null,
    };
}

function normalize(rawCats, rawTasks) {
    const cats = Object.values(rawCats || {})
        .filter((c) => c.name)
        .map((c) => ({
            cat_id: c.cat_id,
            name: c.name,
            location: c.location ?? null,
            sort: c.sort ?? MAX,
            intake: { ...defaultIntake(), ...(c.intake || {}) },
            released: !!c.released,
            prev_released: !!c.prev_released,
            medical: sortedValues(c.medical),
            diet: sortedValues(c.diet),
        }))
        .sort(bySort);
    const tasks = Object.entries(rawTasks || {})
        .map(([key, t]) => ({ ...t, key }))
        .sort(bySort);
    return { cats, tasks };
}

// ---- 局部更新：改動先排進佇列，0.5 秒內的合併成一次送出 ----
// key 是「欄位|路徑」，同一格連續改只送最後一次
const queued = new Map();
const inflight = new Set();
const isPending = ref(false);

const opKey = (op) => `${op.column}|${(op.path || []).join('/')}${op.if_missing ? '?' : ''}`;
const busy = (column, path) => {
    const key = `${column}|${path.join('/')}`;
    return queued.has(key) || inflight.has(key);
};

function queue(ops) {
    if (isDisabled.value) return;
    for (const op of ops) queued.set(opKey(op), op);
    isPending.value = true;
    flushSoon();
}

const flushSoon = debounce(flush, 500);

async function flush() {
    if (!formData.value.recordId || queued.size === 0) return;
    const entries = [...queued.entries()];
    queued.clear();
    entries.forEach(([key]) => inflight.add(key));
    try {
        saveStatus.value = 'saving';
        const res = await $fetch('/api/shift/update', {
            method: 'POST',
            body: { recordId: formData.value.recordId, ops: entries.map(([, op]) => op) },
        });
        // 存好了：記進自己這份原始資料，再廣播給其他開著這一班的人（他們照路徑套上）
        applyOpsToRaw(res.ops || []);
        broadcastShift('ops', { ops: res.ops || [] });
        saveStatus.value = 'success';
        lastSavedAt.value = new Date();
    } catch (e) {
        console.error('flush error:', e);
        saveStatus.value = 'error';
        // 失敗的放回佇列等重試；期間又改過的以新的為準
        for (const [key, op] of entries) if (!queued.has(key)) queued.set(key, op);
    } finally {
        entries.forEach(([key]) => inflight.delete(key));
        isPending.value = queued.size > 0;
    }
}

// 貓還不在這班的記錄裡（例如今天才新增的貓）時先補上基本資料，已經有就不動
const catBase = (cat) => ({
    column: 'cats',
    path: [String(cat.cat_id)],
    value: { cat_id: cat.cat_id, name: cat.name, location: cat.location, sort: cat.sort },
    if_missing: true,
});

function saveIntake(cat) {
    queue([
        catBase(cat),
        { column: 'cats', path: [String(cat.cat_id), 'intake'], value: { ...cat.intake } },
    ]);
}

function toggleReleased(cat) {
    cat.released = !cat.released;
    queue([
        catBase(cat),
        { column: 'cats', path: [String(cat.cat_id), 'released'], value: cat.released },
    ]);
}

// 打勾時記下誰（登入者的暱稱）、幾點；取消就清掉
function stampDone(item) {
    item.done_by = item.done ? nickname.value || '未命名' : null;
    item.done_at = item.done ? new Date().toISOString() : null;
}

function doneLabel(item) {
    return `${item.done_by} ${$dayjs(item.done_at).format('HH:mm')}`;
}

function saveCatItem(cat, list, item) {
    queue([
        catBase(cat),
        { column: 'cats', path: [String(cat.cat_id), list, String(item.id)], value: { ...item } },
    ]);
}

function saveTask(task) {
    const { key, ...value } = task;
    queue([{ column: 'tasks', path: [key], value }]);
}

// 回報只送內容；名字與時間由 server 填（只能改自己那一段）。
// 本地也先更新，發送到 LINE 才拿得到最新的
function saveReport(key) {
    if (!me.value) return;
    const text = drafts.value[key] || '';
    const reports = formData.value.reports;
    reports[key] = { ...(reports[key] || {}) };
    reports[key][me.value] = { name: nickname.value, text, at: new Date().toISOString() };
    queue([{ column: 'reports', path: [key, me.value], value: { text } }]);
}

// 儲存按鈕：馬上送出還沒送的改動
async function saveNow() {
    flushSoon.cancel();
    if (queued.size === 0) {
        if (saveStatus.value !== 'error') lastSavedAt.value = new Date();
        return;
    }
    await flush();
}

const saveHint = computed(() => {
    if (saveStatus.value === 'error') return '儲存失敗，請再按一次儲存';
    if (saveStatus.value === 'saving') return '';
    if (isPending.value) return '有變更尚未儲存';
    return lastSavedAt.value ? `✓ 已儲存 ${$dayjs(lastSavedAt.value).format('HH:mm')}` : '';
});

// 別人存檔：把對方改的值套進畫面，自己還沒送出的格子不動
function mergeRemote(row) {
    const remote = normalize(row.cats, row.tasks);
    const local = formData.value;

    for (const rc of remote.cats) {
        const id = String(rc.cat_id);
        const lc = local.cats.find((c) => c.cat_id === rc.cat_id);
        if (!lc) {
            local.cats.push(rc);
            continue;
        }
        const raw = row.cats[id] || {};
        if (raw.intake && !busy('cats', [id, 'intake'])) lc.intake = rc.intake;
        if ('released' in raw && !busy('cats', [id, 'released'])) lc.released = rc.released;
        if ('prev_released' in raw) lc.prev_released = rc.prev_released;
        for (const list of ['medical', 'diet']) {
            for (const ri of rc[list]) {
                if (busy('cats', [id, list, String(ri.id)])) continue;
                const li = lc[list].find((i) => i.id === ri.id);
                if (!li) lc[list].push(ri);
                else if ('done' in ri) Object.assign(li, pickDone(ri));
            }
        }
    }
    local.cats.sort(bySort);

    for (const rt of remote.tasks) {
        if (busy('tasks', [rt.key])) continue;
        const lt = local.tasks.find((t) => t.key === rt.key);
        if (!lt) local.tasks.push(rt);
        else if ('done' in rt) Object.assign(lt, pickDone(rt));
    }

    for (const [key, byUser] of Object.entries(row.reports || {})) {
        for (const [uid, entry] of Object.entries(byUser || {})) {
            if (busy('reports', [key, uid])) continue;
            local.reports[key] = { ...(local.reports[key] || {}), [uid]: entry };
            if (uid === me.value) drafts.value[key] = entry?.text || '';
        }
    }
}

const pickDone = ({ done, done_by, done_at }) => ({
    done: !!done,
    done_by: done_by ?? null,
    done_at: done_at ?? null,
});

// ---- 留言：每隻貓、每個分頁一個頻道（跨班），面板在 ShiftCommentDrawer。
// 這裡只留這一班的留言與上一班勾了「重要」的，給 💬 的數字與橘點用（橘點只維持一班） ----
const comments = ref([]); // 這一班的留言
const handovers = ref([]); // 上一班勾了「重要」的留言
const drawerOpen = ref(false);
const drawerCat = ref(null);

const TABS = ['arrive', 'care', 'meal', 'required'];
const SHIFT_LABELS = { morning: '早班', night: '晚班' };
const TAB_LABELS = { arrive: '觀察', care: '醫療', meal: '備餐', required: '收尾' };
const tabLabel = computed(() => TAB_LABELS[tab.value]);

const inThisTab = (list, catId) =>
    list.filter((c) => c.cat_id === catId && c.tab === tab.value);
const commentCount = (catId) => inThisTab(comments.value, catId).length;
const hasHandover = (catId) => inThisTab(handovers.value, catId).length > 0;

// ---- 照片：這一班、這隻貓、這個分頁（觀察、醫療）的照片。檔案在 Storage，網址由 server 發 ----
const photos = ref([]); // 這一班的照片（含 url、thumb_url）
const photoTab = ref('arrive'); // 面板目前是哪個分頁的照片
// 選好的照片（含上傳中、失敗的）：{ key, file, previewUrl, note, catId, tab, status }
// status：idle 還沒按上傳 → queued 排隊中 → compressing 壓縮中 → uploading 上傳中 → saving 儲存中 → done／error
const pendingPhotos = ref([]);
const BUSY = ['queued', 'compressing', 'uploading', 'saving'];

const photoOpen = ref(false);
const photoCat = ref(null);
const photoInput = ref(null);

const photosOf = (catId, key) => photos.value.filter((p) => p.cat_id === catId && p.tab === key);
const photoCount = (catId, key) => photosOf(catId, key).length;
const drawerPhotos = computed(() =>
    photoCat.value ? photosOf(photoCat.value.cat_id, photoTab.value) : []
);
// 面板目前這隻貓、這個分頁的預覽與上傳狀態
const drawerPending = computed(() =>
    photoCat.value
        ? pendingPhotos.value.filter((p) => p.catId === photoCat.value.cat_id && p.tab === photoTab.value)
        : []
);
const isUploading = computed(() => drawerPending.value.some((p) => BUSY.includes(p.status)));
const uploadedCount = computed(() => drawerPending.value.filter((p) => p.status === 'done').length);
const failedCount = computed(() => drawerPending.value.filter((p) => p.status === 'error').length);
// 這一輪在傳的：排隊、進行中、已完成（沒按上傳的與失敗的不算，重試一張時就只算那一張）
const uploadBatch = computed(() =>
    drawerPending.value.filter((p) => p.status === 'done' || BUSY.includes(p.status))
);
const uploadPercent = computed(() => {
    const batch = uploadBatch.value;
    if (!batch.length) return 0;
    const sum = batch.reduce((total, p) => total + (p.status === 'done' ? 100 : p.progress), 0);
    return Math.round(sum / batch.length);
});
const STATUS_TEXT = {
    queued: '排隊中',
    compressing: '壓縮中',
    uploading: '上傳中',
    saving: '儲存中',
    done: '✓ 完成',
    error: '上傳失敗',
};
const canDeletePhoto = (photo) => photo.uploaded_by === me.value || isAdmin.value;

function openPhotos(cat, key) {
    photoCat.value = cat;
    photoTab.value = key;
    photoOpen.value = true;
    // 上次有篩選就清掉，清掉時 watch 會重新載入；沒有就直接載入（不要載兩次）
    if (photoKindFilter.value.length) photoKindFilter.value = [];
    else openPhotoHistory();
}

// ---- 類型篩選（可多選）：空陣列 = 全部，有選就看有其中任一類的照片。換篩選就從這一班重新往前找 ----
const photoKindFilter = ref([]);
const photoKindList = computed(() => PHOTO_KINDS[photoTab.value] || []);
const matchesKindFilter = (photo) =>
    !photoKindFilter.value.length || (photo.kinds || []).some((k) => photoKindFilter.value.includes(k));
// 多選標籤：點一下加、再點一下拿掉（照片類型、篩選共用）
const toggleKind = (list, kind) => (list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind]);
watch(photoKindFilter, () => {
    if (!photoOpen.value) return;
    selecting.value = false;
    selectedIds.value = [];
    openPhotoHistory();
});

// ---- 照片牆往前翻：這一班的在 photos（即時更新），前面的班在 photoHistory ----
const photoHistory = ref([]);
const historyShifts = ref([]); // 已經往前載入的班（含沒照片的）{ date, shift, id }
const historyCursor = ref(null); // 已載入最舊的那班 { date, shift }，下次從它往前
const historyHasMore = ref(false);
const historyLoading = ref(false);
const photoListEl = ref(null);
const FIRST_SHIFTS = 4; // 打開時：這一班加前面 4 班
const MORE_SHIFTS = 5; // 之後每次往前 5 班

const shiftKeyOf = (date, shift) => `${date}-${shift === 'night' ? 1 : 0}`;
const shiftLabel = ({ date, shift }) => `${$dayjs(date).format('MM/DD')} ${SHIFT_LABELS[shift]}`;

// 上傳時間：當天傳的只寫時間；之後才補傳的連日期一起寫（跨年再加年份）
function photoTime(photo, group) {
    const at = $dayjs(photo.created_at);
    if (at.format('YYYY-MM-DD') === group.date) return at.format('HH:mm');
    return at.format(at.year() === $dayjs(group.date).year() ? 'MM/DD HH:mm' : 'YYYY/MM/DD HH:mm');
}

// 面板裡的照片照班分組，舊的班在上。照片物件都是原本那一份（改描述才會留著）
// 每一班都有一組（沒照片的班也在，看得出滑到哪一天、也能補傳），舊的在上
const drawerGroups = computed(() => {
    if (!photoCat.value) return [];
    const { date, shift } = channelCurrent.value;
    const groups = historyShifts.value
        .map((s) => ({
            key: shiftKeyOf(s.date, s.shift),
            date: s.date,
            shift: s.shift,
            shiftId: s.id,
            isCurrent: false,
            photos: photoHistory.value.filter(
                (p) =>
                    p.date === s.date &&
                    p.shift === s.shift &&
                    p.cat_id === photoCat.value.cat_id &&
                    p.tab === photoTab.value &&
                    matchesKindFilter(p)
            ),
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
    return [
        ...groups,
        {
            key: shiftKeyOf(date, shift),
            date,
            shift,
            shiftId: formData.value.recordId,
            isCurrent: true,
            photos: drawerPhotos.value.filter(matchesKindFilter),
        },
    ];
});
const drawerAllPhotos = computed(() => drawerGroups.value.flatMap((g) => g.photos));

// 看大圖：只在同一班的照片之間左右換張（照畫面順序）
const photoViewerIndex = ref(null);
const photoViewerKey = ref(null); // 點開的是哪一班
const viewerPhotos = computed(() => {
    const group = drawerGroups.value.find((g) => g.key === photoViewerKey.value);
    return (group?.photos || []).map((p) => ({
        url: p.url,
        label: shiftLabel(group),
        meta: `${p.author_name || '未命名'} ${photoTime(p, group)}`,
        kinds: p.kinds,
        text: p.note,
        raw: p,
    }));
});

function openPhotoViewer(photo) {
    const group = drawerGroups.value.find((g) => g.photos.some((p) => p.id === photo.id));
    if (!group) return;
    photoViewerKey.value = group.key;
    photoViewerIndex.value = group.photos.findIndex((p) => p.id === photo.id);
}

function editFromViewer(photo) {
    photoViewerIndex.value = null;
    editPhoto(photo);
}

async function scrollPhotosToBottom() {
    await nextTick();
    if (photoListEl.value) photoListEl.value.scrollTop = photoListEl.value.scrollHeight;
}

// 傳好後捲到傳到的那一班：這一班就到最下面；以前的班把那班的分隔線捲到最上面，新照片就在下面
async function scrollPhotosToShift({ date, shift }) {
    if (date === channelCurrent.value.date && shift === channelCurrent.value.shift) return scrollPhotosToBottom();
    await nextTick();
    const list = photoListEl.value;
    const divider = list?.querySelector(`[data-shift="${shiftKeyOf(date, shift)}"]`);
    if (!divider) return;
    // 傳完預覽收起、照片格重新出現時是在最上面；直接跳過去（慢慢捲會經過頂端、觸發載入更早的班）
    list.scrollTop += divider.getBoundingClientRect().top - list.getBoundingClientRect().top - 8;
}

// 往前載入 count 班（沒照片的班也算，畫面會顯示分隔線）
async function loadPhotoHistory(count) {
    const from = historyCursor.value || channelCurrent.value;
    const data = await $fetch('/api/shift/photos/history', {
        params: {
            catId: photoCat.value.cat_id,
            tab: photoTab.value,
            date: from.date,
            shift: from.shift,
            count,
            ...(photoKindFilter.value.length ? { kinds: photoKindFilter.value.join(',') } : {}),
        },
        cache: 'no-store',
    });
    photoHistory.value.push(...data.photos.filter((p) => !photoHistory.value.some((h) => h.id === p.id)));
    historyShifts.value.push(
        ...data.shifts.filter((s) => !historyShifts.value.some((h) => h.date === s.date && h.shift === s.shift))
    );
    historyCursor.value = data.cursor;
    historyHasMore.value = data.hasMore;
}

async function openPhotoHistory() {
    photoHistory.value = [];
    historyShifts.value = [];
    historyCursor.value = null;
    historyHasMore.value = false;
    historyLoading.value = true;
    try {
        await loadPhotoHistory(FIRST_SHIFTS);
    } catch (e) {
        console.error('load photo history error:', e);
    } finally {
        historyLoading.value = false;
    }
    scrollPhotosToBottom();
}

// 捲到最上面就再往前 5 班，載入後畫面停在原本看的地方
async function onPhotoScroll() {
    const el = photoListEl.value;
    if (!el || el.scrollTop > 60 || historyLoading.value || !historyHasMore.value) return;
    historyLoading.value = true;
    const fromBottom = el.scrollHeight - el.scrollTop;
    try {
        await loadPhotoHistory(MORE_SHIFTS);
        await nextTick();
        el.scrollTop = el.scrollHeight - fromBottom;
    } catch (e) {
        console.error('load more photos error:', e);
    } finally {
        historyLoading.value = false;
    }
}

async function loadPhotos(recordId) {
    try {
        photos.value = await $fetch('/api/shift/photos', {
            params: { shiftId: recordId },
            cache: 'no-store',
        });
    } catch (e) {
        console.error('loadPhotos error:', e);
    }
}

function addPhoto(row) {
    if (!photos.value.some((p) => p.id === row.id)) photos.value.push(row);
}

// 選了照片：先放進預覽，讓人每張寫描述，按「上傳」才開始傳
// 照片要傳到哪一班：null = 正在看的這一班；按以前某班分隔線上的 📷 就是那一班 { shiftId, date, shift }
const photoTarget = ref(null);

// 還在編輯期限內的班都能補傳（跟頁面的 isDisabled 同一個規則）。
// 那班還沒有紀錄（沒人打開過）的話，上傳時先建一筆（見 ensureShiftId）
const canUploadTo = (group) => isEditableDate(group.date);

// 補傳到還沒有紀錄的班：先用 GET /api/shift 建好那一班（跟有人打開那班一樣），同一班只建一次
const creatingShifts = new Map();
function ensureShiftId(item) {
    if (item.shiftId) return Promise.resolve(item.shiftId);
    const key = shiftKeyOf(item.date, item.shift);
    if (!creatingShifts.has(key)) {
        creatingShifts.set(
            key,
            $fetch('/api/shift', { params: { date: item.date, shift: item.shift }, cache: 'no-store' })
                .then((data) => {
                    const known = historyShifts.value.find((s) => s.date === item.date && s.shift === item.shift);
                    if (known) known.id = data.recordId;
                    return data.recordId;
                })
                .finally(() => creatingShifts.delete(key))
        );
    }
    return creatingShifts.get(key).then((id) => (item.shiftId = id));
}

function pickPhotosFor(group) {
    photoTarget.value = group ? { shiftId: group.shiftId, date: group.date, shift: group.shift } : null;
    photoInput.value?.click();
}

// 預覽裡的照片都是要補傳到以前同一班時，標題寫出是哪一班
const pendingPastLabel = computed(() => {
    const past = drawerPending.value.filter((p) => p.shiftId !== formData.value.recordId);
    return past.length && past.length === drawerPending.value.length ? shiftLabel(past[0]) : '';
});

function onPickPhotos(event) {
    const files = [...(event.target.files || [])];
    event.target.value = ''; // 同一張再選一次也會觸發
    if (!files.length || !photoCat.value) return;
    const target = photoTarget.value || {
        shiftId: formData.value.recordId,
        date: channelCurrent.value.date,
        shift: channelCurrent.value.shift,
    };
    photoTarget.value = null;
    pendingPhotos.value.push(
        ...files.map((file) => ({
            key: `${Date.now()}-${Math.random()}`,
            file,
            previewUrl: URL.createObjectURL(file),
            note: '',
            kinds: [],
            catId: photoCat.value.cat_id,
            tab: photoTab.value,
            ...target,
            status: 'idle',
            progress: 0,
        }))
    );
}

function dropPending(items) {
    const keys = new Set(items.map((p) => p.key));
    items.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    pendingPhotos.value = pendingPhotos.value.filter((p) => !keys.has(p.key));
}

const removePending = (item) => dropPending([item]);

// 「取消」：清掉這個面板還沒傳、或傳失敗的（傳好的已經在照片格裡了）
const clearPending = () => dropPending(drawerPending.value.filter((p) => !BUSY.includes(p.status)));

// 關掉面板：還沒按上傳的就放棄；正在上傳的會在背景繼續傳完
watch(photoOpen, (open) => {
    if (!open && !isUploading.value) clearPending();
});

const { uploadFile } = usePhotoUpload();

// 一張：壓縮 → 拿一次性上傳網址 → 大圖、縮圖直接傳到 Storage → 記一筆（含描述）。
// 進度：壓縮 0～10%、大圖 10～85%（照實際傳了多少）、縮圖 85～95%、記錄 95～100%
async function uploadOne(item) {
    let shiftId = item.shiftId;
    const step = (from, to) => (ratio) => {
        item.progress = Math.round(from + (to - from) * Math.min(1, Math.max(0, ratio)));
    };
    try {
        shiftId = await ensureShiftId(item);
        item.status = 'compressing';
        item.progress = 3;
        const { full, thumb } = await compressPhoto(item.file);
        item.progress = 10;
        item.status = 'uploading';
        const [slot] = await $fetch('/api/shift/photos/upload-url', {
            method: 'POST',
            body: { shiftId, catId: item.catId, tab: item.tab, count: 1 },
        });
        await uploadFile(slot.path, slot.token, full.blob, step(10, 85));
        await uploadFile(slot.thumbPath, slot.thumbToken, thumb.blob, step(85, 95));
        item.status = 'saving';
        item.progress = 97;
        const row = await $fetch('/api/shift/photos', {
            method: 'POST',
            body: {
                shiftId,
                catId: item.catId,
                tab: item.tab,
                note: item.note,
                kinds: [...item.kinds],
                path: slot.path,
                thumbPath: slot.thumbPath,
                width: full.width,
                height: full.height,
                size: full.blob.size,
            },
        });
        // 補傳到以前的班：放進往前翻的那份，標上是哪一班
        if (shiftId === formData.value.recordId) addPhoto(row);
        else photoHistory.value.push({ ...row, date: item.date, shift: item.shift });
        broadcastPhotos(shiftId, 'upsert', [row]);
        item.progress = 100;
        item.status = 'done';
    } catch (e) {
        console.error('upload photo error:', e);
        item.status = 'error';
    }
}

// 一張一張傳。全部成功就回到照片格；有失敗的留在預覽，讓人按「重試」
async function uploadItems(items) {
    if (!formData.value.recordId || !items.length) return;
    items.forEach((p) => {
        p.status = 'queued';
        p.progress = 0;
    });
    for (const item of items) await uploadOne(item);

    const group = pendingPhotos.value.filter((p) => p.catId === items[0].catId && p.tab === items[0].tab);
    if (group.every((p) => p.status === 'done')) {
        dropPending(group);
        ElMessage.success(`已上傳 ${group.length} 張`);
        scrollPhotosToShift(items[0]);
    } else if (group.some((p) => p.status === 'error')) {
        ElMessage.error('有照片上傳失敗，可以按「重試」');
    }
}

const uploadPending = () =>
    uploadItems(drawerPending.value.filter((p) => p.status === 'idle' || p.status === 'error'));
const retryUpload = (item) => uploadItems([item]);

// 編輯照片（上傳的人或管理員）：類型與描述在同一個視窗。類型全部取消＝不分類，描述清空＝沒有描述
const photoEditing = ref(null);
const kindDraft = ref([]);
const noteDraft = ref('');
const savingPhotoEdit = ref(false);

function editPhoto(photo) {
    photoEditing.value = photo;
    kindDraft.value = [...(photo.kinds || [])];
    noteDraft.value = photo.note || '';
}

async function savePhotoEdit() {
    const photo = photoEditing.value;
    if (!photo) return;
    savingPhotoEdit.value = true;
    try {
        const res = await $fetch('/api/shift/photos/update', {
            method: 'POST',
            body: { id: photo.id, kinds: [...kindDraft.value], note: noteDraft.value },
        });
        photo.kinds = res.kinds;
        photo.note = res.note;
        broadcastPhotos(photo.shift_id, 'upsert', [photo]);
        photoEditing.value = null;
    } catch (e) {
        console.error('savePhotoEdit error:', e);
        ElMessage.error('儲存失敗，請再試一次');
    } finally {
        savingPhotoEdit.value = false;
    }
}

// ---- 選取模式：勾多張一次刪 ----
const selecting = ref(false);
const selectedIds = ref([]);
const deleting = ref(false);
const deletablePhotos = computed(() => drawerAllPhotos.value.filter(canDeletePhoto));
const allSelected = computed(
    () => deletablePhotos.value.length > 0 && selectedIds.value.length === deletablePhotos.value.length
);

function toggleSelectMode() {
    selecting.value = !selecting.value;
    selectedIds.value = [];
}

function toggleSelect(photo) {
    if (!canDeletePhoto(photo)) return;
    selectedIds.value = selectedIds.value.includes(photo.id)
        ? selectedIds.value.filter((id) => id !== photo.id)
        : [...selectedIds.value, photo.id];
}

function toggleSelectAll() {
    selectedIds.value = allSelected.value ? [] : deletablePhotos.value.map((p) => p.id);
}

// 關掉面板或換一隻貓就離開選取模式
watch([photoOpen, photoCat, photoTab], () => {
    selecting.value = false;
    selectedIds.value = [];
});

async function deleteSelected() {
    const ids = [...selectedIds.value];
    if (!ids.length) return;
    const { isConfirmed } = await Swal.fire({
        text: `確定要刪除這 ${ids.length} 張照片嗎？刪除後無法復原。`,
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });
    if (!isConfirmed) return;
    deleting.value = true;
    try {
        await $fetch('/api/shift/photos/delete', { method: 'POST', body: { ids } });
        const removed = drawerAllPhotos.value.filter((p) => ids.includes(p.id));
        photos.value = photos.value.filter((p) => !ids.includes(p.id));
        photoHistory.value = photoHistory.value.filter((p) => !ids.includes(p.id));
        for (const shiftId of new Set(removed.map((p) => p.shift_id))) {
            broadcastPhotos(shiftId, 'delete', removed.filter((p) => p.shift_id === shiftId));
        }
        ElMessage.success(`已刪除 ${ids.length} 張`);
        selecting.value = false;
        selectedIds.value = [];
    } catch (e) {
        console.error('deleteSelected error:', e);
        ElMessage.error('刪除失敗，請再試一次');
    } finally {
        deleting.value = false;
    }
}

// 編輯視窗裡的「刪除這張照片」：確認刪掉後關掉視窗
async function deleteEditingPhoto() {
    const photo = photoEditing.value;
    if (photo && (await deletePhoto(photo))) photoEditing.value = null;
}

// 回傳有沒有真的刪掉（按取消或失敗是 false）
async function deletePhoto(photo) {
    const { isConfirmed } = await Swal.fire({
        text: '確定要刪除這張照片嗎？',
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#b33a39',
    });
    if (!isConfirmed) return false;
    try {
        await $fetch('/api/shift/photos/delete', { method: 'POST', body: { id: photo.id } });
        photos.value = photos.value.filter((p) => p.id !== photo.id);
        photoHistory.value = photoHistory.value.filter((p) => p.id !== photo.id);
        broadcastPhotos(photo.shift_id, 'delete', [photo]);
        return true;
    } catch (e) {
        console.error('deletePhoto error:', e);
        ElMessage.error('刪除失敗，請再試一次');
        return false;
    }
}

// 留言頻道要的「正在看的這一班」（formData.date 是 Date，API 要 YYYY-MM-DD）
const channelCurrent = computed(() => ({
    recordId: formData.value.recordId,
    date: $dayjs(formData.value.date).format('YYYY-MM-DD'),
    shift: formData.value.shift,
}));

function openComments(cat) {
    drawerCat.value = cat;
    drawerOpen.value = true;
}

// 這一班的留言（算 💬 的數字）。頻道裡寫到別班的不算
function addComment(row) {
    if (row.shift_id !== formData.value.recordId) return;
    if (!comments.value.some((c) => c.id === row.id)) comments.value.push(row);
}

function removeComment(id) {
    comments.value = comments.value.filter((c) => c.id !== id);
    handovers.value = handovers.value.filter((c) => c.id !== id);
}

async function loadComments(params) {
    try {
        const data = await $fetch('/api/shift/comments', { params, cache: 'no-store' });
        comments.value = data.current;
        handovers.value = data.previous;
    } catch (e) {
        console.error('loadComments error:', e);
    }
}

// ---- 分頁內容 ----

// 不屬於單一貓咪的項目照位置分組，排序是全員 → 貓屋 → 位置（placeRank，跟後台一致）
function groupTasks(filter) {
    const map = new Map();
    for (const task of formData.value.tasks.filter(filter)) {
        const name = placeName(task.location);
        if (!map.has(name)) map.set(name, { name, location: task.location, items: [] });
        map.get(name).items.push(task);
    }
    return [...map.values()].sort((a, b) => placeRank(a.location) - placeRank(b.location));
}

// 醫療分頁：醫療管理的所有項目（醫療、餵藥、外用），每一項左邊標類別。
// 拌進飯裡的藥是飲食管理的「隨餐藥」，在備餐分頁
const medicalSections = computed(() =>
    [{ tab: 'care', match: () => true, empty: '這一班沒有醫療事項' }].map(({ tab, match, empty }) => ({
        tab,
        empty,
        cats: formData.value.cats
            .map((cat) => ({ cat, items: cat.medical.filter(match) }))
            .filter((entry) => entry.items.length > 0),
        taskGroups: groupTasks((t) => t.kind === 'medical' && match(t)),
    }))
);

// 備餐：全員的飲食併進每隻貓，位置的併進那個位置的貓。只有隨餐藥要打勾，其他只看。
// 同類別排在一起：乾乾 → 罐罐 → 隨餐藥 → 補充品 → 放風 → 其他；同類別裡自己的在前、全員／位置的在後（sort 是穩定的）
const DIET_ORDER = { 乾乾: 0, 罐罐: 1, 隨餐藥: 2, 補充品: 3, 放風: 4, 其他: 5 };
const isMealMed = (item) => item.category === '隨餐藥';
const byDietOrder = (a, b) => (DIET_ORDER[a.category] ?? 9) - (DIET_ORDER[b.category] ?? 9);

// 已照類別排好的清單，相鄰同類別的併成 { category, items }
function groupByCategory(list) {
    const rows = [];
    for (const item of list) {
        const last = rows[rows.length - 1];
        if (last && last.category === item.category) last.items.push(item);
        else rows.push({ category: item.category, items: [item] });
    }
    return rows;
}

const appliesTo = (task, cat) => !task.location || task.location === cat.location;

// 每一項包成 { key, source, item }：item 是原本的物件（隨餐藥打勾要改到它），source 是全員／位置的來源標籤
const leaveCats = computed(() => {
    const dietTasks = formData.value.tasks.filter((t) => t.kind === 'diet');
    return formData.value.cats.map((cat) => {
        const items = [
            ...cat.diet.map((d) => ({ key: `diet-${d.id}`, source: null, item: d, category: d.category })),
            ...dietTasks
                .filter((t) => appliesTo(t, cat))
                .map((t) => ({ key: t.key, source: placeName(t.location), item: t, category: t.category })),
        ].sort(byDietOrder);
        return { cat, dietRows: groupByCategory(items) };
    });
});

// 隨餐藥打勾：貓自己的存在那隻貓底下；全員／位置的是整班一份
function saveDietItem(cat, { source, item }) {
    if (source) saveTask(item);
    else saveCatItem(cat, 'diet', item);
}

// 全員／位置的飲食只併進適用的貓；那個位置現在沒有貓的就不顯示，也不算未完成
// 收尾分頁：有收尾項目的貓（照貓的順序），以及全員、貓屋、位置的（groupTasks 照 placeRank 排）
const requiredItems = computed(() => formData.value.tasks.filter((t) => t.kind === 'required'));
const requiredCats = computed(() =>
    formData.value.cats
        .map((cat) => ({ cat, items: requiredItems.value.filter((t) => t.cat_id === cat.cat_id) }))
        .filter((entry) => entry.items.length > 0)
);
const requiredGroups = computed(() => groupTasks((t) => t.kind === 'required' && !t.cat_id));

// 每個分頁上方：上一班同一個分頁的回報，以及那個分頁沒勾完的項目
function prevBlock(key) {
    const { date, shift, reports, unfinished } = prev.value;
    return {
        // 標題直接寫是哪一班（例如 10/20 晚班），所在的分頁已經說明了是哪一類
        title: date ? `${$dayjs(date).format('MM/DD')} ${SHIFT_LABELS[shift]}` : '前班',
        entriesLabel: '前班回報',
        countLabel: '人回報',
        entries: entriesOf(reports, key),
        unfinished: unfinished?.[key] || [],
        // 前班每次打開頁面都收起，展開不記住（不給 storageKey）
        defaultCollapsed: true,
    };
}

// 這一班、這個分頁，其他人寫的回報（自己的在輸入框裡）
const othersEntries = computed(() =>
    entriesOf(formData.value.reports, tab.value).filter((r) => r.key !== me.value)
);

// 分頁上的數字：還沒打勾的項目數
const tabList = computed(() => {
    const undone = (list) => list.filter((i) => !i.done).length;
    const sectionUndone = (tab) => {
        const section = medicalSections.value.find((s) => s.tab === tab);
        return (
            section.cats.reduce((sum, e) => sum + undone(e.items), 0) +
            section.taskGroups.reduce((sum, g) => sum + undone(g.items), 0)
        );
    };
    return [
        { value: 'arrive', label: '觀察', remaining: 0 },
        { value: 'care', label: '醫療', remaining: sectionUndone('care') },
        {
            value: 'meal',
            label: '備餐',
            // 只有隨餐藥要打勾；全員／位置的整班一份，只算一次
            remaining:
                formData.value.cats.reduce((sum, c) => sum + undone(c.diet.filter(isMealMed)), 0) +
                undone(
                    formData.value.tasks.filter(
                        (t) =>
                            t.kind === 'diet' &&
                            isMealMed(t) &&
                            formData.value.cats.some((cat) => appliesTo(t, cat))
                    )
                ),
        },
        {
            value: 'required',
            label: '收尾',
            // 只算畫面上看得到的（貓已經不在這班的不算）
            remaining:
                requiredCats.value.reduce((sum, e) => sum + undone(e.items), 0) +
                requiredGroups.value.reduce((sum, g) => sum + undone(g.items), 0),
        },
    ];
});

// ---- 選班：標題列的前後箭頭與下方的選擇面板。班用 { date: 'YYYY-MM-DD', shift } 表示 ----
const WEEKDAYS = '日一二三四五六';
const todayStr = () => $dayjs().format('YYYY-MM-DD');
const minDate = $dayjs(config.public.releaseDate || '2024-01-01').format('YYYY-MM-DD');

const viewing = computed(() => ({
    date: $dayjs(formData.value.date).format('YYYY-MM-DD'),
    shift: formData.value.shift || 'morning',
}));

function shiftTitle({ date, shift }) {
    const d = $dayjs(date);
    return `${d.format('MM/DD')} 週${WEEKDAYS[d.day()]} ${SHIFT_LABELS[shift]}`;
}

// 早班的上一班是前一天晚班；晚班的上一班是同一天早班
function prevOf({ date, shift }) {
    return shift === 'night'
        ? { date, shift: 'morning' }
        : { date: $dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'), shift: 'night' };
}

function nextOf({ date, shift }) {
    return shift === 'morning'
        ? { date, shift: 'night' }
        : { date: $dayjs(date).add(1, 'day').format('YYYY-MM-DD'), shift: 'morning' };
}

const sameShift = (a, b) => a.date === b.date && a.shift === b.shift;

// 今天 18:00 前不能看晚班（跟 /medicine 一樣，避免提早建立晚班的記錄）
const nightLocked = (date) => date === todayStr() && new Date().getHours() < 18;

function canGo({ date, shift }) {
    if (!date || date > todayStr() || date < minDate) return false;
    return !(shift === 'night' && nightLocked(date));
}

function nowShift() {
    return { date: todayStr(), shift: new Date().getHours() < 18 ? 'morning' : 'night' };
}

// 快速前往：現在這一班往前數四班
const quickShifts = computed(() => {
    const dayName = (date) =>
        ({ 0: '今天', 1: '昨天', 2: '前天' })[$dayjs().startOf('day').diff($dayjs(date), 'day')] ||
        $dayjs(date).format('MM/DD');
    const list = [];
    let item = nowShift();
    for (let i = 0; i < 4; i++) {
        list.push({
            ...item,
            label: i === 0 ? '現在這一班' : `${dayName(item.date)}${SHIFT_LABELS[item.shift]}`,
        });
        item = prevOf(item);
    }
    return list;
});

const pickerOpen = ref(false);
const pick = ref({ date: '', shift: 'morning' });

function openPicker() {
    pick.value = { ...viewing.value };
    pickerOpen.value = true;
}

// 換到今天、又還沒 18:00 時，晚班選不了，自動改回早班
function onPickDate() {
    if (pick.value.shift === 'night' && nightLocked(pick.value.date)) pick.value.shift = 'morning';
}

function goTo({ date, shift }) {
    if (!canGo({ date, shift })) return;
    pickerOpen.value = false;
    router.push({ name: 'shift', query: { date, shift, tab: tab.value } });
}

// 編輯期限：照「日期」算，今天加前 N 天（DISABLED_DAYS，預設 2）的早晚班都能改、能補傳照片。
// 例如今天 10/22：10/20、10/21、10/22 的早晚班都可以，10/19 以前不行
function isEditableDate(date) {
    const earliest = $dayjs().startOf('day').subtract(config.public.disabledDays || 2, 'day');
    return !$dayjs(date).startOf('day').isBefore(earliest);
}

const isDisabled = computed(() => !isEditableDate(formData.value.date));

// Methods
function setTab(value) {
    tab.value = value;
    router.replace({ query: { ...route.query, tab: value } });
}

// 上一班放風的貓：預設收起觀察欄位，已經填過的預設展開；兩種都可以自己展開或收起。
// intakeToggled 記使用者按過的狀態（cat_id → 要不要展開），沒按過就照預設
const intakeToggled = ref({});
function intakeTouched(cat) {
    const defaults = defaultIntake();
    return Object.keys(defaults).some((key) => (cat.intake[key] ?? null) !== defaults[key]);
}
const showIntake = (cat) =>
    !cat.prev_released || (intakeToggled.value[cat.cat_id] ?? intakeTouched(cat));
function toggleIntake(cat) {
    intakeToggled.value = { ...intakeToggled.value, [cat.cat_id]: !showIntake(cat) };
}

function foodHandler(cat, type) {
    cat.intake[type === 'can' ? 'can_detail' : 'feed_detail'] = 0;
}

function fecesHandler(cat) {
    cat.intake.feces_warning = cat.intake.feces ? '正常' : null;
}

function InitFromQuery() {
    const { date, shift, tab: queryTab } = route.query;

    formData.value.date = date ? new Date(date) : new Date();
    formData.value.shift = ['morning', 'night'].includes(shift)
        ? shift
        : new Date().getHours() < 18
        ? 'morning'
        : 'night';
    // 舊連結：?tab=meds（吃藥分頁已併進醫療）、?tab=leave（備餐改叫 meal）
    const wanted = { meds: 'care', leave: 'meal' }[queryTab] || queryTab;
    if (TABS.includes(wanted)) tab.value = wanted;
}

async function InitShift() {
    const { date, shift } = formData.value;
    const params = { date: $dayjs(date).format('YYYY-MM-DD'), shift };
    // cache: 'no-store'：同一個網址同時被請求兩次時（開兩個分頁、或直接打開過 API 網址），
    // Chrome 會讓後到的等前一個寫完快取，最多卡 20 秒。這兩支每次都要最新資料，不用快取
    const [data, prevData] = await Promise.all([
        $fetch('/api/shift', { params, cache: 'no-store' }),
        // 前一班唯讀：沒有記錄就回空的，不會建立
        $fetch('/api/shift/previous', { params, cache: 'no-store' }).catch((e) => {
            console.error('InitPrevShift error:', e);
            return null;
        }),
    ]);

    const { cats, tasks } = normalize(data.cats, data.tasks);
    formData.value.recordId = data.recordId;
    formData.value.date = new Date(data.date);
    formData.value.shift = data.shift;
    formData.value.cats = cats;
    formData.value.tasks = tasks;
    formData.value.reports = { ...data.reports };
    drafts.value = Object.fromEntries(
        TABS.map((key) => [key, data.reports?.[key]?.[me.value]?.text || ''])
    );
    prev.value = {
        date: prevData?.date || null,
        shift: prevData?.shift || null,
        reports: prevData?.reports || {},
        released: prevData?.released || [],
        unfinished: prevData?.unfinished || {},
    };

    setRaw(data);
    subscribeToShift(data.recordId);

    // 留言、照片要等這一班建立好才查得到，所以放在後面
    await Promise.all([loadComments(params), loadPhotos(data.recordId)]);
}

// ---- 即時同步（Broadcast，見 composables/useBroadcast.js）----
// 一班一個私人頻道 shift:<id>，三種訊息：
//   ops：別人存好的格子（跟 /api/shift/update 一樣的 { column, path, value }），照路徑套上
//   comment：這一班新增或刪除的留言（💬 的數字與橘點用；留言內容在 ShiftCommentDrawer 自己的頻道）
//   photo：🗂️ 照片牆新增、修改、刪除的照片
const { join: joinBroadcast, send: sendBroadcast } = useBroadcast();
const shiftChannel = ref(null);
const shiftTopic = (id) => `shift:${id}`;

// 這一班在資料庫裡的原始樣子（cats、tasks 以 id 為 key 的物件、reports）。
// 收到別人的 ops 時先套在這份上，再只拿改到的那幾隻貓、那幾項去合併進畫面（mergeRemote）
let remoteRaw = { cats: {}, tasks: {}, reports: {} };
const cloneJson = (v) => JSON.parse(JSON.stringify(v ?? {}));

function setRaw(data) {
    remoteRaw = { cats: cloneJson(data.cats), tasks: cloneJson(data.tasks), reports: cloneJson(data.reports) };
}

// 跟資料庫的 shift_apply 一樣：照路徑設值，中間缺的層補成 {}；if_missing 的只在還沒有時才設
function applyOpsToRaw(ops) {
    for (const op of ops) {
        let node = (remoteRaw[op.column] ||= {});
        const path = op.path || [];
        for (const key of path.slice(0, -1)) {
            if (!node[key] || typeof node[key] !== 'object') node[key] = {};
            node = node[key];
        }
        const last = path[path.length - 1];
        if (op.if_missing && node[last] !== undefined) continue;
        node[last] = cloneJson(op.value);
    }
}

// 只合併 ops 改到的貓、事項、回報
function mergeOps(ops) {
    const row = { cats: {}, tasks: {}, reports: {} };
    for (const op of ops) {
        const [first, second] = op.path || [];
        if (op.column === 'cats' && remoteRaw.cats[first]) row.cats[first] = remoteRaw.cats[first];
        if (op.column === 'tasks' && remoteRaw.tasks[first]) row.tasks[first] = remoteRaw.tasks[first];
        if (op.column === 'reports' && remoteRaw.reports[first]?.[second]) {
            row.reports[first] = { ...(row.reports[first] || {}), [second]: remoteRaw.reports[first][second] };
        }
    }
    mergeRemote(row);
}

const broadcastShift = (event, payload, shiftId = formData.value.recordId) =>
    sendBroadcast(shiftTopic(shiftId), event, payload, shiftChannel.value);

// 照片牆的照片（留言附的不算）：補傳到別班就發到那一班的頻道
function broadcastPhotos(shiftId, action, list) {
    const wall = list.filter((p) => !p.comment_id);
    if (!shiftId || !wall.length) return;
    const payload = action === 'delete' ? { action, ids: wall.map((p) => p.id) } : { action, photos: wall.map(cloneJson) };
    broadcastShift('photo', payload, shiftId);
}

function applyRemotePhotos({ action, photos: list = [], ids = [] }) {
    if (action === 'delete') {
        photos.value = photos.value.filter((p) => !ids.includes(p.id));
        photoHistory.value = photoHistory.value.filter((p) => !ids.includes(p.id));
        return;
    }
    for (const photo of list) {
        if (photo.shift_id === formData.value.recordId) {
            const i = photos.value.findIndex((p) => p.id === photo.id);
            if (i >= 0) photos.value.splice(i, 1, photo);
            else photos.value.push(photo);
            continue;
        }
        // 正在往前翻的那幾班裡的照片也一起更新
        const shift = historyShifts.value.find((s) => s.id === photo.shift_id);
        if (!shift) continue;
        const withShift = { ...photo, date: shift.date, shift: shift.shift };
        const i = photoHistory.value.findIndex((p) => p.id === photo.id);
        if (i >= 0) photoHistory.value.splice(i, 1, withShift);
        else photoHistory.value.push(withShift);
    }
}

// 自己在留言頻道新增、刪除留言：更新數字，再告訴其他開著這一班的人
function onCommentAdded(row) {
    addComment(row);
    if (row.shift_id) broadcastShift('comment', { action: 'upsert', comment: cloneJson(row) }, row.shift_id);
}

function onCommentRemoved(id) {
    removeComment(id);
    broadcastShift('comment', { action: 'delete', id });
}

// 編輯留言可能改了「重要」，影響下一班的橘點：自己重抓留言數，也叫開著這一班的人重抓
function onCommentUpdated() {
    reloadComments();
    broadcastShift('comment', { action: 'refresh' });
}

function reloadComments() {
    return loadComments({ date: channelCurrent.value.date, shift: channelCurrent.value.shift });
}

function onRemoteComment({ action, comment, id }) {
    if (action === 'delete') removeComment(id);
    else if (action === 'refresh') reloadComments();
    else addComment(comment);
}

// 斷線重連、從背景回來：重新抓這一班（合併進畫面，不打斷正在編輯的格子）、留言數、照片
async function resyncShift() {
    const params = { date: channelCurrent.value.date, shift: channelCurrent.value.shift };
    try {
        const data = await $fetch('/api/shift', { params, cache: 'no-store' });
        if (data.recordId !== formData.value.recordId) return;
        setRaw(data);
        mergeRemote(data);
        lastUpdatedAt.value = new Date();
    } catch (e) {
        console.error('resync shift error:', e);
    }
    await Promise.all([reloadComments(), loadPhotos(formData.value.recordId)]);
}

function subscribeToShift(recordId) {
    shiftChannel.value?.leave();
    shiftChannel.value = joinBroadcast(
        shiftTopic(recordId),
        {
            ops: ({ ops = [] }) => {
                applyOpsToRaw(ops);
                mergeOps(ops);
                lastUpdatedAt.value = new Date();
            },
            comment: onRemoteComment,
            photo: applyRemotePhotos,
        },
        { onResync: resyncShift }
    );
}

// 「LINE 發送至群組」：這一班、這個分頁的回報＋留言（照貓分組），可以勾選最多 4 張照片一起發。
// 跟 /regular、/medicine 一樣先跳確認視窗，按「是的」才送。回報、留言、照片都沒有才擋下
const LINE_PHOTOS_MAX = 4;

async function sendTabToLine() {
    const key = tab.value;
    const label = TAB_LABELS[key];

    try {
        loadingNotify.value = true;
        // 先把還沒存的回報存掉，發出去的才跟資料庫一致
        await saveNow();

        const entries = entriesOf(formData.value.reports, key);
        const preview = await $fetch('/api/shift/line/preview', {
            params: { shiftId: formData.value.recordId, tab: key },
            cache: 'no-store',
        });
        if (!entries.length && !preview.comments.length && !preview.photos.length) {
            ElMessage.warning(`這一班還沒有${label}回報或留言`);
            return;
        }

        const textSite =
            config.public.deploySite === 'feliformia' ? '' : `[${config.public.deploySite || 'Local'}]\n`;
        const prefix = textSite;

        const result = await confirmLinePush({
            label,
            entries,
            photos: preview.photos,
            comments: preview.comments,
            // 整段實際要發的文字（文字太長會切成好幾則，算還能附幾張照片用）
            fullText: (text) => prefix + text,
        });
        if (!result) return;

        try {
            await $fetch('/api/shift/line/push', {
                method: 'POST',
                body: {
                    shiftId: formData.value.recordId,
                    tab: key,
                    text: prefix + result.text,
                    photoIds: result.photoIds,
                },
            });
            // 成功、失敗都用畫面上方的小提示，不用再按 OK
            ElMessage.success('已發送至群組');
        } catch {
            ElMessage.error({ message: '發送失敗，請確認網路狀態後重試', duration: 5000 });
        }
    } catch (e) {
        console.error('sendTabToLine error:', e);
        ElMessage.error({ message: '讀取內容失敗，請再試一次', duration: 5000 });
    } finally {
        loadingNotify.value = false;
    }
}

// 發到 LINE 的文字：標題、日期班別，再來【回報】（一人一段）與【留言】（照貓分組，順序跟頁面一樣）
function buildLineText(label, entries, comments) {
    const d = $dayjs(formData.value.date);
    const lines = [
        `值班記錄｜${label}`,
        '---------------',
        `日期： ${d.format('YYYY/MM/DD')}（${WEEKDAYS[d.day()]}）`,
        `班別： ${SHIFT_LABELS[formData.value.shift]}`,
        '---------------',
    ];
    if (entries.length) {
        // 跟留言同一個格式：「・名字 時間」，內容在下一行縮兩格
        lines.push('【回報】');
        for (const e of entries) {
            lines.push(`・${e.name || '（舊資料）'}${e.at ? ` ${$dayjs(e.at).format('HH:mm')}` : ''}`);
            lines.push(...e.text.trim().split('\n').map((l) => `  ${l}`));
        }
    }
    if (comments.length) {
        lines.push(lineCommentsTitle(entries));
        lineCatGroups(comments).forEach((group, i) => {
            if (i > 0) lines.push('');
            lines.push(group.title);
            for (const c of group.comments) lines.push(lineCommentText(c));
        });
    }
    return lines.join('\n');
}

// 【留言】標題；前面有回報就空一行
const lineCommentsTitle = (entries) => (entries.length ? '\n【留言】' : '【留言】');

// 留言照貓分組，貓的順序跟頁面一樣；每隻貓一段：貓頭＋名字＋分隔線，貓與貓之間空一行
function lineCatGroups(comments) {
    const catOrder = formData.value.cats.map((c) => c.cat_id);
    const rank = (catId) => (catOrder.includes(catId) ? catOrder.indexOf(catId) : 9999);
    const catIds = [...new Set(comments.map((c) => c.cat_id))].sort((a, b) => rank(a) - rank(b));
    return catIds.map((catId) => ({
        catId,
        title: `🐱 ${catNameOf(catId)} ─────`,
        comments: comments.filter((c) => c.cat_id === catId),
    }));
}

// 一則留言：「・名字 時間 標記」，內容在下一行縮兩格
function lineCommentText(c) {
    const tags = [c.for_next ? '★重要' : '', c.photo_count ? `📷${c.photo_count}` : ''].filter(Boolean).join(' ');
    const lines = [`・${c.author_name || '未命名'} ${$dayjs(c.created_at).format('HH:mm')}${tags ? ` ${tags}` : ''}`];
    if (c.body) lines.push(...c.body.trim().split('\n').map((l) => `  ${l}`));
    return lines.join('\n');
}

// 這段文字發出去會分成幾則、還能附幾張照片（一次推播最多 5 則：文字先佔，剩下的給照片，最多 4 張）
function lineBudget(fullText) {
    const chunks = splitText(fullText).length;
    return { chunks, room: Math.max(0, Math.min(LINE_PHOTOS_MAX, LINE_MESSAGES_MAX - chunks)) };
}

// 確認視窗（el-dialog，跟「編輯照片」同一種樣子）：上面是要發的文字，留言可以直接在預覽裡點掉（預設全勾，
// 沒勾的變灰劃線、不會發出去）；下面是這班照片可以勾（預設都不勾）。
// 文字超過 LINE 一則 5000 字時，提醒會分成幾則，可以再取消幾則留言，或改成直接編輯文字（字數、則數、照片上限即時更新）。
// 回傳 { text, photoIds }，按取消回傳 null
const linePush = ref(null); // { label, entries, comments, chosen, editing, text, photos, fullText, selected, resolve }

function confirmLinePush({ label, entries, photos, comments, fullText }) {
    const ordered = [...photos].sort(
        (a, b) => Number(b.important) - Number(a.important) || b.created_at.localeCompare(a.created_at)
    );
    return new Promise((resolve) => {
        linePush.value = {
            label,
            entries,
            comments,
            chosen: comments.map((c) => c.id), // 預設每則留言都發
            editing: false, // 改成直接編輯文字後，text 才是要發的內容
            text: '',
            photos: ordered,
            fullText,
            selected: [], // 預設不附照片，要的自己勾
            resolve,
        };
    });
}

// 要發的文字：還沒改成直接編輯時，照勾選的留言組出來
const linePushText = computed(() => {
    const lp = linePush.value;
    if (!lp) return '';
    if (lp.editing) return lp.text;
    return buildLineText(lp.label, lp.entries, lp.comments.filter((c) => lp.chosen.includes(c.id)));
});

// 預覽：回報那一段照原樣，留言照貓分組、一則一列可以點掉
const linePushPreview = computed(() => {
    const lp = linePush.value;
    if (!lp) return null;
    return {
        head: buildLineText(lp.label, lp.entries, []),
        commentsTitle: lp.comments.length ? lineCommentsTitle(lp.entries) : '',
        groups: lineCatGroups(lp.comments).map((g) => ({
            ...g,
            comments: g.comments.map((c) => ({ comment: c, text: lineCommentText(c) })),
        })),
    };
});

function toggleLineComment(id) {
    const lp = linePush.value;
    lp.chosen = lp.chosen.includes(id) ? lp.chosen.filter((x) => x !== id) : [...lp.chosen, id];
    // 沒要發的留言，它的照片也拿掉
    lp.selected = lp.selected.filter((pid) => {
        const photo = lp.photos.find((p) => p.id === pid);
        return !photo?.comment_id || lp.chosen.includes(photo.comment_id);
    });
}

// 改成直接編輯：從現在勾選組出的文字開始改；回到勾選會丟掉手動改的內容
function editLinePushText() {
    const lp = linePush.value;
    lp.text = linePushText.value;
    lp.editing = true;
}

function closeLinePush(result) {
    const current = linePush.value;
    linePush.value = null;
    current?.resolve(result);
}

const linePushBudget = computed(() => {
    const lp = linePush.value;
    if (!lp) return { chunks: 1, room: 0, length: 0 };
    const full = lp.fullText(linePushText.value, lp.selected.length);
    return { ...lineBudget(full), length: full.length };
});

// 文字變長、能附的變少：多勾的從後面拿掉
watch(
    () => linePushBudget.value.room,
    (room) => {
        if (linePush.value && linePush.value.selected.length > room) {
            linePush.value.selected = linePush.value.selected.slice(0, room);
        }
    }
);

function toggleLinePhoto(photo) {
    const lp = linePush.value;
    if (lp.selected.includes(photo.id)) {
        lp.selected = lp.selected.filter((id) => id !== photo.id);
    } else if (lp.selected.length >= linePushBudget.value.room) {
        ElMessage.warning(`最多只能附 ${linePushBudget.value.room} 張`);
    } else {
        lp.selected = [...lp.selected, photo.id];
    }
}

const catNameOf = (catId) => formData.value.cats.find((c) => c.cat_id === catId)?.name || '（已刪除的貓）';

// 確認視窗裡的照片分兩區：留言附的（照留言分組，留言照時間）、照片牆的（照時間）
const linePushGroups = computed(() => {
    const lp = linePush.value;
    if (!lp) return { comments: [], wall: [] };
    const byTime = (a, b) => a.created_at.localeCompare(b.created_at);
    const comments = lp.comments
        .filter((comment) => lp.chosen.includes(comment.id))
        .map((comment) => ({ comment, photos: lp.photos.filter((p) => p.comment_id === comment.id).sort(byTime) }))
        .filter((g) => g.photos.length)
        .sort((a, b) => byTime(a.comment, b.comment));
    return { comments, wall: lp.photos.filter((p) => !p.comment_id).sort(byTime) };
});

function sendLinePush() {
    const lp = linePush.value;
    const text = linePushText.value.trim();
    if (!text) {
        ElMessage.warning('內容不能是空的');
        return;
    }
    if (!lp.editing && !lp.entries.length && !lp.chosen.length && !lp.selected.length) {
        ElMessage.warning('沒有要發送的回報、留言或照片');
        return;
    }
    // 照顯示的順序發
    closeLinePush({ text, photoIds: lp.photos.filter((p) => lp.selected.includes(p.id)).map((p) => p.id) });
}

// 頁面離開前警告
function handleBeforeUnload(e) {
    if (isPending.value) {
        e.preventDefault();
        e.returnValue = '你有未儲存的變更，確定要離開嗎？';
        return e.returnValue;
    }
}

// Vue Router 導航離開前警告（手機滑動返回）
onBeforeRouteLeave((to, from, next) => {
    if (isPending.value) {
        const answer = window.confirm('你有未儲存的變更，確定要離開嗎？');
        if (!answer) {
            next(false);
            return;
        }
    }
    next();
});

async function load() {
    loading.value = true;
    try {
        InitFromQuery();
        await InitShift();
    } catch (error) {
        Swal.fire({
            html: `網路連線異常<br>請確認連線後重試。<br><br>錯誤：${error.message}`,
        });
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    load();
});

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    shiftChannel.value?.leave();
});

// 換日期或班別才重新載入；只換分頁不用。換班前先把還沒送出的存掉
watch(
    () => [route.query.date, route.query.shift],
    async ([date, shift], [oldDate, oldShift]) => {
        if (date !== oldDate || shift !== oldShift) {
            flushSoon.cancel();
            await flush();
            load();
        }
    }
);
</script>

<style lang="scss" scoped>
#shift {
    a {
        display: block;
    }

    .last-update,
    .last-saved {
        margin: 0 0 5px 0;
        color: #ccc;
        font-size: 11px;
    }

    .line-green {
        background-color: #03c100;
        color: white;
    }

    // 回報卡片下面的 LINE 按鈕：跟卡片拉開，不要黏在一起
    .report .line-green {
        margin-top: 14px;
    }

    // ---- 回報：跟上面的項目分開；我的回報收成一張卡片（標題／輸入框／儲存列） ----
    .report-title {
        margin-top: 24px;
        margin-bottom: 10px;
    }

    .my-report {
        overflow: hidden;
        border: 1px solid #d8d4d1;
        border-radius: 6px;
        background: #fff;
        text-align: left;

        .mr-head {
            display: flex;
            align-items: baseline;
            gap: 8px;
            padding: 9px 10px;
            border-bottom: 1px solid #eee;

            .mr-title {
                font-size: 14px;
                font-weight: 500;
                color: #4a4542;
            }
        }

        // 輸入框在卡片裡不要自己的框線；全域把 textarea 設成至少 100px，這裡交給 autosize
        :deep(.el-textarea__inner) {
            min-height: 76px !important;
            padding: 9px 10px;
            border: none;
            border-radius: 0;
            box-shadow: none !important;
            font-size: 15px;
        }

        .mr-foot {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 7px 8px 8px 10px;
            border-top: 1px solid #eee;
        }

        .save-hint {
            font-size: 12px;
            color: #8e8783;

            &.saved {
                color: #529b2e;
            }

            &.error {
                color: #b33a39;
            }
        }

        // 全域 button 有 width: 100%，這裡蓋回來
        .save-btn {
            flex-shrink: 0;
            width: auto;
            height: 32px;
            margin: 0;
            padding: 0 18px;
            border: none;
            border-radius: 6px;
            background: #6da2c2;
            color: #fff;
            font-size: 14px;
            cursor: pointer;

            &:disabled {
                cursor: default;
                opacity: 0.5;
            }
        }
    }

    // ---- 觀察：跟 /regular 相同的吃喝排泄樣式 ----
    .el-slider {
        &.is-disabled {
            opacity: 0.5;
            :deep(.el-slider__marks-text) {
                color: #bbb;
            }
        }
    }

    .intake {
        .food {
            .el-slider {
                width: calc(100% - 60px);
                transform: translate(0, -6px);
            }
            .el-checkbox {
                width: 40px;
                margin-top: 4px;
            }
        }

        .excretion {
            > .d_flex {
                justify-content: start;
                flex-wrap: nowrap;
            }
            .W40 {
                display: flex;
                flex-wrap: nowrap;
                justify-content: start;
                padding-top: 12px;
                width: 80px;
            }
            .W60 {
                padding-left: 24px;
                width: calc(100% - 80px);
                :deep(.el-radio-group) {
                    display: flex;
                    flex-wrap: nowrap;
                    justify-content: start;
                    width: 100%;
                    label {
                        margin-right: 10px;
                    }
                }
            }
        }
    }
}

// ---- 標題列：標題靠左，「‹ 10/19 週日 早班 ›」靠右 ----
.shift-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;

    h1 {
        // 全域 h1 有 margin-bottom: 10px !important（element-variables.css），不蓋掉會跟右邊錯開
        margin: 0 !important;
        flex-shrink: 0;
        font-size: 20px;
        text-align: left;
        // 光學補償：Noto Sans TC 中文墨水比行框中心低，22px 約 1.7px（見 /admin 各頁），20px 等比約 1.5px
        transform: translateY(-1.5px);
    }
}

// 全域 button 有 width: 100%、邊框、底色、padding，這裡每一項都要蓋回來
.shift-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;

    button {
        height: 40px;
        margin: 0;
        border: 1px solid #d8d4d1;
        border-radius: 6px;
        background: #fff;
        color: #4a4542;
        cursor: pointer;
    }

    .nav-btn {
        width: 32px;
        flex-shrink: 0;
        padding: 0;
        font-size: 20px;
        line-height: 1;
        color: #657181;

        &:disabled {
            cursor: default;
            color: #ccc;
            border-color: #eee;
        }
    }

    .current-btn {
        width: auto;
        min-width: 0;
        padding: 0 10px;
        font-size: 14px;
        white-space: nowrap;
        border-color: #6da2c2;
    }
}

// ---- 分頁 ----
.tabs {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    gap: 6px;
    margin: 0 0 14px;
    padding: 8px 0;
    background: #fff;

    // 五個分頁在手機上每個只有 64px：蓋掉全域 button 的左右 10px padding，
    // 字和數字縮一點、不換行，「醫療 5」才放得下一行
    button {
        flex: 1;
        min-width: 0;
        height: 40px;
        padding: 0 2px;
        white-space: nowrap;
        border: 1px solid #d8d4d1;
        border-radius: 6px;
        background: #fff;
        color: #657181;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;

        &.active {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }
    }

    .remaining {
        display: inline-block;
        min-width: 16px;
        height: 16px;
        margin-left: 3px;
        padding: 0 4px;
        border-radius: 8px;
        background: #b33a39;
        color: #fff;
        font-size: 11px;
        line-height: 16px;
        vertical-align: 1px;
    }
}

// 分區小標題：貓咪／全員與區域（同後台）。卡片本身有 14px 下邊距，第二個標題上方再補一點
.section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
    font-size: 15px;
    font-weight: 500;
    color: #4a4542;
    text-align: left;

    // 標題後面拉一條細線到右邊，讀起來像段落分隔
    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #d8d4d1;
    }

    &.later {
        margin-top: 14px;
    }
}

.report {
    margin-top: 6px;
}

// ---- 卡片：跟 /medicine 相同 ----
.record_item {
    padding-right: 10px;
    border: 1px solid #d8d4d1;
    border-radius: 6px;
    margin-bottom: 14px;

    &:nth-child(even) {
        background-color: transparent;
    }

    &:first-child {
        border-top-color: #d8d4d1;
    }

    // 貓名 14px，行高經實測補償，見 pages/medicine.vue
    padding-top: 35px;

    // 不用 overflow: hidden 裁圓角：觀察分頁的滑桿標籤（吃光）會超出右邊被切掉。
    // 改成標籤自己配合卡片的圓角（6px 減掉 1px 邊框）
    .name {
        height: 26px;
        font-size: 14px;
        line-height: 25px;
        border-top-left-radius: 5px;
        border-bottom-right-radius: 6px;
    }

    // 觀察分頁滑桿最右邊的「吃光」會超出滑桿半個字寬，右邊留跟 /regular 一樣的 25px
    &.intake-card {
        padding-right: 25px;
    }


    // 誰、幾點勾的
    .detail .txt font.done-by {
        padding-top: 0;
        font-size: 12px;
        color: #6da2c2;
    }

    // 收尾清單沒有左邊的類別欄，文字從頭開始
    &.required-card .detail > .item-row > .d_flex {
        width: 100%;
    }

    // 上一班放風：標籤與「仍要登記」在卡片右上角，跟貓名同一列
    .released-row {
        position: absolute;
        top: 4px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    // 全域 button 有 width: 100%、邊框、底色、padding，這裡蓋回來
    .released-toggle {
        width: auto;
        height: 24px;
        margin: 0;
        padding: 0 2px;
        border: none;
        background: none;
        color: #3f7ea3;
        font-size: 13px;
        cursor: pointer;
    }

    // 收起時只剩標題列那一行
    &.compact {
        min-height: 34px;
        padding-top: 0;
    }

    .released-badge {
        position: absolute;
        top: 4px;
        right: 8px;
    }

    // 同一列（同類別）裡的多個項目：文字齊左、來源標籤齊右成一欄，
    // 項目之間間距一致，備註緊貼在自己的項目下面
    .diet-item + .diet-item {
        margin-top: 8px;
    }

    .diet-line {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 5px;
    }

    .diet-text {
        flex: 1;
        min-width: 0;
        font-size: 15px;
        color: #222;
    }

    // 備餐的類別有三個字（隨餐藥、補充品），左邊的類別欄從 40px 放寬，不然會斷行
    .detail > .d_flex.diet-row {
        > p {
            width: 50px;
            white-space: nowrap;
        }

        > div {
            width: calc(100% - 55px);
        }
    }

    // 同一類別多項時的序號
    .diet-no {
        flex-shrink: 0;
        min-width: 16px;
        font-size: 14px;
        color: #8e8783;
    }

    // 隨餐藥的「完成」在同一列最右邊
    .diet-done {
        flex-shrink: 0;
        margin-left: 4px;
    }

    .diet-note.done-by {
        font-size: 12px;
        color: #6da2c2;
    }

    .diet-note {
        padding: 0 5px 2px;
        font-size: 14px;
        line-height: 1.4;
        color: #767676;
    }

    // 全員／房間併進來的項目，標出來源（在 .diet-line 裡靠右）
    .source-chip {
        flex-shrink: 0;
        display: inline-block;
        padding: 0 6px;
        border-radius: 3px;
        background: #f0eeec;
        color: #767676;
        font-size: 12px;
        line-height: 20px;
        vertical-align: 1px;
    }

    // 放風：膠囊按鈕，沒勾是外框、勾了變實心。離上緣、右緣留白，不擠著卡片邊框。
    // 全域有 button { width: 100%; border; padding } 的樣式，這裡每一項都要蓋回來
    .release-pill {
        position: absolute;
        top: 7px;
        right: 10px;
        width: auto;
        height: 26px;
        padding: 0 12px;
        border: 1px solid #c9c4c0;
        border-radius: 13px;
        background: #fff;
        color: #657181;
        font-size: 13px;
        line-height: 24px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }

        &:disabled {
            cursor: default;
            opacity: 0.6;
        }
    }

    .detail {
        > .d_flex.divided {
            border-top: 1px dashed #ccc;
            padding-top: 10px;
        }

        > .item-row {
            align-items: baseline;

            > div {
                .done {
                    width: 40px;
                    > label {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        gap: 6px;
                        :deep(.el-checkbox__label) {
                            padding-left: 0 !important;
                            font-size: 12px;
                        }
                    }
                }

                .txt {
                    text-align: left;
                    width: calc(100% - 60px);

                    &.full {
                        width: 100%;
                    }

                    font {
                        display: block;
                        padding: 5px;

                        &.f_grey {
                            opacity: 0.9;
                            font-size: 14px;
                        }
                    }
                }
            }
        }
    }
}

// ---- 表單元件：跟 /regular 相同 ----
:deep(.el-slider__stop) {
    background-color: var(--el-color-primary);
}

:deep(.el-slider__marks-text) {
    color: #657181;
    font-size: 12px;
}

:deep(.el-radio__label) {
    font-weight: 400;
}

:deep(.el-checkbox),
:deep(.el-radio) {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 40px;
    margin-right: 0;

    span {
        padding: 4px 0 0;
        color: #657181;
        font-size: 12px;
        line-height: 14px;
    }

    .el-checkbox__input {
        width: 18px;
        height: 18px;
        padding-top: 0;
    }
}

:deep(.el-input) {
    max-width: 100%;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
    height: 45px;
}

// ---- 選班面板 ----
:deep(.shift-picker-drawer) {
    border-radius: 14px 14px 0 0;

    .el-drawer__body {
        padding: 14px 16px 20px;
        text-align: left;
    }
}

.sp-head {
    display: flex;
    align-items: center;
    margin-bottom: 4px;

    .sp-title {
        font-size: 16px;
        font-weight: 500;
    }

    .sp-close {
        width: auto;
        margin-left: auto;
        padding: 0 4px;
        border: none;
        background: none;
        color: #999;
        font-size: 16px;
        cursor: pointer;
    }
}

.sp-label {
    margin: 14px 0 6px;
    font-size: 13px;
    color: #8e8783;
}

.sp-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .sp-chip {
        width: auto;
        height: 34px;
        margin: 0;
        padding: 0 14px;
        border: 1px solid #d8d4d1;
        border-radius: 17px;
        background: #fff;
        color: #4a4542;
        font-size: 14px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #eaf3f8;
            color: #3f7ea3;
        }
    }
}

// 手機內建的日期選擇器（iPhone 滾輪、Android 日曆）
.sp-date {
    box-sizing: border-box;
    width: 100%;
    height: 42px;
    padding: 0 10px;
    border: 1px solid #d8d4d1;
    border-radius: 6px;
    background: #fff;
    color: #222;
    font-size: 16px; // 小於 16px，iPhone 點下去會自動放大頁面
}

.sp-seg {
    display: flex;
    overflow: hidden;
    border: 1px solid #d8d4d1;
    border-radius: 6px;

    button {
        flex: 1;
        height: 40px;
        margin: 0;
        border: none;
        border-radius: 0;
        background: #fff;
        color: #657181;
        font-size: 14px;
        cursor: pointer;

        & + button {
            border-left: 1px solid #d8d4d1;
        }

        &.on {
            background: #6da2c2;
            color: #fff;
        }

        &:disabled {
            cursor: default;
            color: #bbb;
        }
    }
}

.sp-go {
    width: 100%;
    height: 44px;
    margin: 18px 0 0;
    border: none;
    border-radius: 8px;
    background: #6da2c2;
    color: #fff;
    font-size: 15px;
    cursor: pointer;

    &:disabled {
        cursor: default;
        opacity: 0.5;
    }
}

// ---- 留言 ----
// 貓名標籤原本是 absolute 定位在卡片左上角；包一層讓 💬 能接在名字後面
.record_item .name-wrap {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: flex-start;
    gap: 4px;

    .name {
        position: static;
    }
}

// 不要外框：只有 💬 和數字。全域 button 樣式（width 100%、邊框、底色、padding）每一項都要蓋回來
// 圖示放大，按鈕跟名字標籤一樣高（26px，不然標籤會被擠下來、上面露出白條）；
// 手指可點的範圍用 ::after 往上下再撐 8px，實際約 36×42
.comment-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    width: auto;
    min-width: 36px;
    height: 26px;
    padding: 0 6px;
    border: none;
    background: none;
    color: #999;
    font-size: 19px;
    line-height: 26px;
    cursor: pointer;

    span {
        font-size: 14px;
    }

    &::after {
        content: '';
        position: absolute;
        inset: -8px -2px;
    }

    &.has {
        color: #6da2c2;
        font-weight: 500;
    }

    // 上一班有交代
    .handover-dot {
        position: absolute;
        top: 0;
        right: 0;
        width: 8px;
        height: 8px;
        border: 1.5px solid #fff;
        border-radius: 50%;
        background: #e6a23c;
    }
}

:deep(.comment-drawer) {
    border-radius: 14px 14px 0 0;

    .el-drawer__body {
        display: flex;
        flex-direction: column;
        padding: 0;
    }
}

// ---- 照片面板 ----
// 標題列的文字按鈕（選取、全選、完成）。全域 button 樣式要蓋回來
.cd-link {
    width: auto;
    margin-left: auto;
    padding: 0 4px;
    border: none;
    background: none;
    color: #3f7ea3;
    font-size: 14px;
    cursor: pointer;

    & + .cd-link {
        margin-left: 10px;
    }
}

// 標題列有「選取」時，關閉鈕不再自己靠右
.cd-head .cd-close.after-link {
    margin-left: 10px;
}

// 選取模式的縮圖：可點選，右上角圓圈打勾
.pd-selectable {
    position: relative;
    padding: 0;
    border: 2px solid transparent;
    cursor: pointer;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .pd-check {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 24px;
        height: 24px;
        border: 2px solid #fff;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.25);
        color: transparent;
        font-size: 14px;
        line-height: 20px;
        text-align: center;
    }

    &.selected {
        border-color: #6da2c2;

        .pd-check {
            background: #6da2c2;
            color: #fff;
        }
    }

    // 別人傳的（不是管理員）不能選
    &.locked {
        cursor: default;
        opacity: 0.4;

        .pd-check {
            display: none;
        }
    }
}

.pd-danger {
    background: #b33a39 !important;
}

.pd-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding-top: 10px;
}

.pd-item {
    position: relative;
    min-width: 0;
}

.pd-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 6px;
    background: #f0eeec;
    overflow: hidden;
}

// 點了看大圖的縮圖（button）：全域 button 樣式要蓋回來
.pd-open {
    height: auto;
    margin: 0;
    padding: 0;
    border: none;
    cursor: pointer;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.pd-uploading {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #8e8783;
}

.pd-meta {
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: #8e8783;
}

// 全域 button 有 width: 100%、邊框、底色、padding，這裡每一項都要蓋回來
.pd-del {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 12px;
    line-height: 22px;
    cursor: pointer;
}

.pd-file {
    display: none;
}

.pd-note {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.4;
    color: #222;
    overflow-wrap: anywhere;
}

// 全域 button 有 width: 100%、邊框、底色、padding，這裡蓋回來
// 縮圖左上角的類型標籤（不擋點縮圖看大圖）
.pd-kind {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 0 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 11px;
    line-height: 18px;
    pointer-events: none;
}

.pd-edit {
    width: auto;
    height: auto;
    margin: 2px 0 0;
    padding: 0;
    border: none;
    background: none;
    color: #3f7ea3;
    font-size: 12px;
    cursor: pointer;
}

// 上傳前的預覽：每張照片滿版、描述在正下方。全域 button 樣式要蓋回來
.pp-item {
    padding: 10px 0 14px;

    & + .pp-item {
        border-top: 1px solid #f2f0ee;
    }
}

.pp-stage {
    position: relative;
    border-radius: 8px;
    background: #f4f3f2;
    overflow: hidden;
}

.pp-image {
    display: block;
    width: 100%;
    height: min(38vh, 280px);
}

.pp-remove {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 15px;
    line-height: 30px;
    cursor: pointer;
}

// 上傳狀態：蓋在照片上
.pp-status {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: 15px;
    pointer-events: none;

    &.queued {
        background: rgba(255, 255, 255, 0.6);
        color: #657181;
    }

    &.done {
        background: rgba(0, 0, 0, 0.2);
        font-weight: 500;
    }

    &.error {
        background: rgba(179, 58, 57, 0.6);
        pointer-events: auto;
    }
}

// 進行中：實際的進度（百分比跟著上傳的位元組數走）
.pp-bar {
    width: 70%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.35);
    overflow: hidden;

    i {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: #fff;
        transition: width 0.2s linear;
    }
}

.pp-status b {
    margin-left: 4px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
}

.pp-retry {
    width: auto;
    height: 30px;
    padding: 0 16px;
    border: none;
    border-radius: 15px;
    background: #fff;
    color: #b33a39;
    font-size: 14px;
    cursor: pointer;
}

// 上傳前選類型：一排膠囊，選中的實心
.pp-kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 8px 0;

    // 手機寬度一排放得下六個
    .pp-kind {
        width: auto;
        height: 28px;
        margin: 0;
        padding: 0 9px;
        border: 1px solid #d8d4d1;
        border-radius: 14px;
        background: #fff;
        color: #657181;
        font-size: 13px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }

        &:disabled {
            cursor: default;
            opacity: 0.6;
        }
    }
}

// ---- LINE 發送確認視窗 ----
.lp-text {
    max-height: 40vh;
    overflow-y: auto;
    padding: 10px 12px;
    border-radius: 8px;
    background: #f7f6f5;
    color: #333;
    font-size: 14px;
    line-height: 1.55;
    text-align: left;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

// 預覽裡的一則留言：左邊勾選框，沒勾的變灰劃線
.lp-pick {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    height: auto;
    margin: 2px 0;
    padding: 4px 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    line-height: inherit;
    text-align: left;
    cursor: pointer;

    .lp-check {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-top: 2px;
        border: 1.5px solid #6da2c2;
        border-radius: 4px;
        background: #6da2c2;
        box-sizing: border-box;
        color: #fff;
        font-size: 12px;
        line-height: 1;
    }

    .lp-pick-text {
        flex: 1;
        min-width: 0;
        white-space: pre-wrap;
    }

    &.off {
        .lp-check {
            background: #fff;
        }

        .lp-pick-text {
            color: #b5b0ac;
            text-decoration: line-through;
        }
    }
}

.lp-cat-gap {
    margin-top: 1.55em;
}

.lp-hint {
    margin-bottom: 6px;
    font-size: 12px;
    color: #8e8783;
    text-align: left;
}

// 提示裡的文字按鈕
.lp-link {
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: #6da2c2;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
}

.lp-back {
    display: block;
    margin-top: 6px;
    font-size: 12px;
}

.lp-warn {
    margin-bottom: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    background: #fdf6ec;
    color: #b36b00;
    font-size: 13px;
    line-height: 1.5;
    text-align: left;
}

.lp-textarea :deep(.el-textarea__inner) {
    font-size: 14px;
    line-height: 1.5;
}

// 「附上照片」：上面一條分隔線跟文字分開，標題＋已選張數，下面一行提示可以點照片勾選
.lp-section {
    margin: 18px 0 4px;
    padding-top: 14px;
    border-top: 1px solid #e5e2df;
    text-align: left;

    .lp-section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 15px;
        font-weight: 500;
        color: #4a4542;
    }

    .lp-count {
        padding: 0 8px;
        border-radius: 10px;
        background: #eef4f8;
        color: #3f7ea3;
        font-size: 12px;
        line-height: 20px;
        font-variant-numeric: tabular-nums;
    }

    .lp-section-hint {
        margin-top: 2px;
        font-size: 12px;
        color: #8e8783;
    }
}

.lp-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px 6px;
    text-align: left;
}

.lp-cell {
    min-width: 0;
}

// 照片：勾了是藍框＋右上角 ✓
.lp-photo {
    position: relative;
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .lp-mark {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 22px;
        height: 22px;
        border: 2px solid #fff;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.25);
        box-sizing: border-box;
        color: #fff;
        font-size: 13px;
        line-height: 18px;
        text-align: center;
    }

    &.on {
        outline: 3px solid #6da2c2;
        outline-offset: -3px;

        .lp-mark {
            background: #6da2c2;
        }
    }

    &:disabled {
        cursor: default;
        opacity: 0.5;
    }

    .lp-important {
        position: absolute;
        bottom: 3px;
        left: 3px;
        padding: 0 4px;
        border-radius: 3px;
        background: #fde9cc;
        color: #b36b00;
        font-size: 10px;
    }
}

// 兩區的小標題（留言的照片、照片牆）
.lp-sub {
    margin: 12px 0 6px;
    font-size: 13px;
    color: #4a4542;
    text-align: left;
}

// 一則留言一塊：灰底卡片，上面是貓、誰、幾點、說了什麼，下面是照片
.lp-comment {
    margin-bottom: 8px;
    padding: 10px;
    border-radius: 8px;
    background: #f7f6f5;
    text-align: left;

    .lp-comment-head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #8e8783;

        b {
            font-weight: 500;
            color: #4a4542;
        }
    }

    .lp-comment-body {
        margin: 2px 0 8px;
        font-size: 14px;
        line-height: 1.45;
        color: #222;
        white-space: pre-line;
        overflow-wrap: anywhere;
    }
}

.lp-important-tag {
    padding: 0 5px;
    border-radius: 3px;
    background: #fde9cc;
    color: #b36b00;
    font-size: 11px;
}

// 照片牆的每張：哪隻貓・誰傳的、類型標籤、描述
.lp-wall-who {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.35;
    color: #8e8783;

    b {
        font-weight: 500;
        color: #4a4542;
    }
}

.lp-wall-kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 3px;

    span {
        padding: 0 5px;
        border-radius: 3px;
        background: #eef4f8;
        color: #3f7ea3;
        font-size: 10px;
        line-height: 16px;
    }
}

.lp-wall-note {
    display: -webkit-box;
    margin-top: 2px;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.35;
    color: #222;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}

// 編輯照片視窗裡的「刪除這張照片」：紅字，放在描述下面
.pe-delete {
    width: auto;
    height: auto;
    margin: 12px 0 0;
    padding: 0;
    border: none;
    background: none;
    color: #b33a39;
    font-size: 14px;
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
    }
}

// 編輯照片視窗裡的小標題（類型、描述）
.pe-label {
    margin: 4px 0 2px;
    font-size: 13px;
    font-weight: 500;
    color: #8e8783;
    text-align: left;
}

// 全域把 textarea 設成至少 100px，這裡照 autosize
.pe-note :deep(.el-textarea__inner) {
    min-height: 0 !important;
}

.pp-note {
    margin-top: 8px;

    :deep(.el-textarea__inner) {
        min-height: 56px !important;
        font-size: 15px;
    }
}

.pd-confirm {
    display: flex;
    gap: 8px;

    .pd-cancel {
        width: 90px;
        flex-shrink: 0;
        height: 42px;
        border: 1px solid #d8d4d1;
        border-radius: 8px;
        background: #fff;
        color: #657181;
        font-size: 15px;
        cursor: pointer;
    }

    .pd-add {
        flex: 1;
    }
}

.pd-add {
    width: 100%;
    height: 42px;
    border: none;
    border-radius: 8px;
    background: #6da2c2;
    color: #fff;
    font-size: 15px;
    cursor: pointer;

    &:disabled {
        cursor: default;
        opacity: 0.5;
    }
}

.cd-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #eee;

    .cd-title {
        font-size: 16px;
        font-weight: 500;
    }

    .cd-tab {
        font-size: 13px;
        color: #6da2c2;
    }

    .cd-close {
        width: auto;
        margin-left: auto;
        padding: 0 4px;
        border: none;
        background: none;
        color: #999;
        font-size: 16px;
        cursor: pointer;
    }
}

// 上傳中的整體進度（標題列下面那條）
.pu-progress {
    padding: 10px 16px 12px;
    border-bottom: 1px solid #eee;
    background: #fafafa;

    .pu-text {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 13px;
        color: #4a4542;

        b {
            font-weight: 500;
            color: #6da2c2;
            font-variant-numeric: tabular-nums;
        }
    }

    .pu-bar {
        height: 6px;
        border-radius: 3px;
        background: #eceae8;
        overflow: hidden;

        i {
            display: block;
            height: 100%;
            border-radius: 3px;
            background: #6da2c2;
            transition: width 0.2s linear;
        }
    }
}

// 照片牆：班與班之間的分隔線（跟留言頻道同一個樣子），這一班是藍色
.pd-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 16px 0 10px;
    font-size: 12px;
    color: #8e8783;

    &::before,
    &::after {
        content: '';
        flex: 1;
        border-top: 1px solid #e5e2df;
    }

    &.current {
        color: #3f7ea3;
    }
}

// 照片牆上方的類型篩選（膠囊樣式跟上傳預覽的類型共用 .pp-kind）
.pd-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 8px 16px;
    border-bottom: 1px solid #eee;

    .pp-kind {
        flex-shrink: 0;
        width: auto;
        height: 28px;
        margin: 0;
        padding: 0 9px;
        border: 1px solid #d8d4d1;
        border-radius: 14px;
        background: #fff;
        color: #657181;
        font-size: 13px;
        cursor: pointer;

        &.on {
            border-color: #6da2c2;
            background: #6da2c2;
            color: #fff;
        }
    }
}

// 以前那班分隔線上的 📷：補傳照片到那一班
.pd-divider-add {
    width: auto;
    height: auto;
    margin: 0 0 0 -4px;
    padding: 0 2px;
    border: none;
    background: none;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
}

// 沒照片的班：分隔線下一行淡淡的小字（跟留言頻道一樣）
.pd-none {
    margin: -4px 0 6px;
    font-size: 12px;
    color: #c4bfbb;
    text-align: center;
}

.pd-hint {
    padding: 8px 0 0;
    font-size: 12px;
    color: #aaa;
    text-align: center;
}

.cd-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 16px 8px;
    text-align: left;
}

.cd-section {
    margin-top: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #8e8783;
}

.cd-empty {
    padding: 14px 0;
    font-size: 14px;
    color: #aaa;
}

.cd-input {
    padding: 10px 16px 16px;
    border-top: 1px solid #eee;

    // 全域把 textarea 設成至少 100px，這裡一行起跳
    :deep(.el-textarea__inner) {
        min-height: 40px !important;
    }
}
</style>

<style lang="scss">
/* LINE 發送確認：內容長時視窗裡面捲動 */
.line-push-dialog {
    max-width: 480px;
    border-radius: 12px;

    .el-dialog__body {
        max-height: 70vh;
        overflow-y: auto;
    }
}

/* 編輯照片的視窗：el-dialog 會 teleport 到 body，scoped 選不到 dialog 本身，這塊不加 scoped */
.photo-edit-dialog {
    max-width: 400px;
    border-radius: 12px;

    .el-dialog__body {
        padding-top: 4px;
        padding-bottom: 4px;
    }
}
</style>
