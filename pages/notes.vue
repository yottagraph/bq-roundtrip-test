<template>
    <div class="notes-page">
        <PageHeader title="Notes" icon="mdi-note-text-outline" />

        <div class="notes-content">
            <v-card v-if="!bqEnabled" class="mb-4">
                <v-card-title>BigQuery is not configured</v-card-title>
                <v-card-text>
                    This page reads and writes the per-tenant BigQuery dataset through the
                    Broadchurch Portal gateway. Set
                    <code>NUXT_PUBLIC_BIGQUERY_ENABLED=true</code> (and the related
                    <code>NUXT_PUBLIC_BIGQUERY_*</code> / <code>NUXT_PUBLIC_GATEWAY_URL</code> /
                    <code>NUXT_PUBLIC_TENANT_ORG_ID</code> vars) on the deployment to enable it.
                </v-card-text>
            </v-card>

            <template v-else>
                <v-card class="mb-4">
                    <v-card-title>New note</v-card-title>
                    <v-card-text>
                        <v-form ref="formRef" @submit.prevent="onSubmit">
                            <v-textarea
                                v-model="draft"
                                label="Note"
                                placeholder="Write something to round-trip through BigQuery…"
                                rows="3"
                                auto-grow
                                :disabled="saving"
                                :rules="[(v: string) => !!v?.trim() || 'Note cannot be empty']"
                                data-testid="note-body"
                            />
                            <div class="d-flex align-center mt-2">
                                <v-btn
                                    type="submit"
                                    color="primary"
                                    :loading="saving"
                                    :disabled="!draft.trim() || saving"
                                    data-testid="save-note"
                                >
                                    Save note
                                </v-btn>
                                <v-spacer />
                                <span v-if="schemaError" class="text-error text-caption">
                                    {{ schemaError }}
                                </span>
                            </div>
                        </v-form>
                    </v-card-text>
                </v-card>

                <v-card>
                    <v-card-title class="d-flex align-center">
                        <span>Saved notes</span>
                        <v-spacer />
                        <v-btn
                            icon="mdi-refresh"
                            variant="text"
                            size="small"
                            :loading="loading"
                            @click="loadNotes"
                        />
                    </v-card-title>
                    <v-data-table
                        :headers="headers"
                        :items="notes"
                        :loading="loading"
                        :items-per-page="25"
                        item-value="id"
                        no-data-text="No notes yet — write one above to round-trip it through BigQuery."
                    >
                        <template #item.created_at="{ item }">
                            <span class="text-no-wrap">{{ formatTimestamp(item.created_at) }}</span>
                        </template>
                        <template #item.body="{ item }">
                            <span class="note-body">{{ item.body }}</span>
                        </template>
                    </v-data-table>
                </v-card>

                <v-alert
                    v-if="loadError"
                    type="error"
                    variant="tonal"
                    density="compact"
                    class="mt-4"
                >
                    {{ loadError }}
                </v-alert>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';

    import { useNotification } from '~/composables/useNotification';

    interface NoteRow {
        id: string;
        body: string;
        created_at: string;
    }

    const config = useRuntimeConfig();
    const bqEnabled = computed(() => String(config.public.bigqueryEnabled ?? '') === 'true');

    const { showSuccess, showError } = useNotification();

    const draft = ref('');
    const saving = ref(false);
    const loading = ref(false);
    const notes = ref<NoteRow[]>([]);
    const schemaError = ref('');
    const loadError = ref('');

    const headers = [
        { title: 'Created', key: 'created_at', sortable: true, width: '220px' },
        { title: 'Note', key: 'body', sortable: false },
    ];

    /**
     * BigQuery returns TIMESTAMP values as a string of fractional Unix epoch
     * seconds (e.g. "1716240000.000000"). Convert to a locale string for
     * display, falling back gracefully for ISO strings.
     */
    function formatTimestamp(raw: string | null | undefined): string {
        if (!raw) return '';
        const asNumber = Number(raw);
        const date = Number.isFinite(asNumber) ? new Date(asNumber * 1000) : new Date(raw);
        if (Number.isNaN(date.getTime())) return String(raw);
        return date.toLocaleString();
    }

    async function ensureSchema() {
        try {
            await $fetch('/api/notes/ensure-schema', { method: 'POST' });
            schemaError.value = '';
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            schemaError.value = `Could not ensure notes table: ${message}`;
            throw err;
        }
    }

    async function loadNotes() {
        loading.value = true;
        loadError.value = '';
        try {
            const res = await $fetch<{ rows: NoteRow[] }>('/api/notes/list');
            notes.value = res.rows ?? [];
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            loadError.value = `Failed to load notes: ${message}`;
        } finally {
            loading.value = false;
        }
    }

    async function onSubmit() {
        const body = draft.value.trim();
        if (!body) return;
        saving.value = true;
        try {
            await $fetch('/api/notes/create', {
                method: 'POST',
                body: { body },
            });
            draft.value = '';
            showSuccess('Note saved');
            await loadNotes();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to save note: ${message}`);
        } finally {
            saving.value = false;
        }
    }

    onMounted(async () => {
        if (!bqEnabled.value) return;
        try {
            await ensureSchema();
        } catch {
            // schemaError already populated; still try to load (the table may exist).
        }
        await loadNotes();
    });
</script>

<style scoped>
    .notes-page {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .notes-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        max-width: 960px;
        width: 100%;
        margin: 0 auto;
    }

    .note-body {
        white-space: pre-wrap;
        word-break: break-word;
    }
</style>
