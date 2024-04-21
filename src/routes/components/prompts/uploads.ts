import { fetchAccountData, fetchFilePointers, account } from "../stores"
import { get } from "svelte/store"
import type OptionPicker from "./OptionPicker.svelte"
import type { FilePointer } from "../../../lib/files"

export let options = {
    FV: [
        {
            name: "Public",
            icon: "/assets/icons/public.svg",
            description: "Everyone can view your uploads",
            id: "public",
        },
        {
            name: "Anonymous",
            icon: "/assets/icons/anonymous.svg",
            description: "Your username will be hidden",
            id: "anonymous",
        },
        {
            name: "Private",
            icon: "/assets/icons/private.svg",
            description: "Nobody but you can view your uploads",
            id: "private",
        },
    ],
    FV2: [
        {
            name: "Public",
            icon: "/assets/icons/public.svg",
            description: "Everyone can view this file",
            id: "public",
        },
        {
            name: "Anonymous",
            icon: "/assets/icons/anonymous.svg",
            description: "Your username will be hidden",
            id: "anonymous",
        },
        {
            name: "Private",
            icon: "/assets/icons/private.svg",
            description: "Nobody but you can view this file",
            id: "private",
        },
    ],
    AYS: [
        {
            name: "Yes",
            icon: "/assets/icons/update.svg",
            id: true,
        },
    ],
}

export function dfv(optPicker: OptionPicker) {
    optPicker.picker("Default file visibility", options.FV).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/auth/dfv`, {
                method: "POST",
                body: JSON.stringify({
                    defaultFileVisibility: exp.selected,
                }),
            }).then((response) => {
                if (response.status != 200) {
                    optPicker.picker(
                        `${response.status} ${
                            response.headers.get("x-backup-status-message") ||
                            response.statusText ||
                            ""
                        }`,
                        []
                    )
                }

                fetchAccountData()
            })
        }
    })
}

export function update_all_files(optPicker: OptionPicker) {
    optPicker
        .picker("You sure?", [
            {
                name: "Yeah",
                icon: "/assets/icons/update.svg",
                description: `This will make all of your files ${
                    get(account)?.defaultFileVisibility || "public"
                }`,
                id: true,
            },
        ])
        .then((exp) => {
            if (exp && exp.selected) {
                fetch(`/files/manage`, {
                    method: "POST",
                    body: JSON.stringify({
                        target: get(account)?.files,
                        action: "changeFileVisibility",

                        value: get(account)?.defaultFileVisibility,
                    }),
                }).then((response) => {
                    if (response.status != 200) {
                        optPicker.picker(
                            `${response.status} ${
                                response.headers.get(
                                    "x-backup-status-message"
                                ) ||
                                response.statusText ||
                                ""
                            }`,
                            []
                        )
                    }

                    fetchAccountData()
                })
            }
        })
}

export function fileOptions(
    optPicker: OptionPicker,
    file: FilePointer & { id: string }
) {
    optPicker
        .picker(file.filename, [
            {
                name: file.tag ? "Remove tag" : "Tag file",
                icon: `/assets/icons/${file.tag ? "tag_remove" : "tag"}.svg`,
                description: file.tag || `File has no tag`,
                id: "tag",
            },
            {
                name: "Change file visibility",
                icon: `/assets/icons/${file.visibility || "public"}.svg`,
                description: `File is currently ${file.visibility || "public"}`,
                id: "changeFileVisibility",
            },
            {
                name: "Delete file",
                icon: `/assets/icons/admin/delete_file.svg`,
                description: ``,
                id: "delete",
            },
        ])
        .then((exp) => {
            if (exp && exp.selected) {
                switch (exp.selected) {
                    case "delete":
                        fetch(`/files/manage`, {
                            method: "POST",
                            body: JSON.stringify({
                                target: [file.id],
                                action: "delete",
                            }),
                        }).then((response) => {
                            if (response.status != 200) {
                                optPicker.picker(
                                    `${response.status} ${
                                        response.headers.get(
                                            "x-backup-status-message"
                                        ) ||
                                        response.statusText ||
                                        ""
                                    }`,
                                    []
                                )
                            }

                            fetchFilePointers()
                        })

                        break

                    case "changeFileVisibility":
                        optPicker
                            .picker("Set file visibility", options.FV2)
                            .then((exp) => {
                                if (exp && exp.selected) {
                                    fetch(`/files/manage`, {
                                        method: "POST",
                                        body: JSON.stringify({
                                            target: [file.id],
                                            action: "changeFileVisibility",

                                            value: exp.selected,
                                        }),
                                    }).then((response) => {
                                        if (response.status != 200) {
                                            optPicker.picker(
                                                `${response.status} ${
                                                    response.headers.get(
                                                        "x-backup-status-message"
                                                    ) ||
                                                    response.statusText ||
                                                    ""
                                                }`,
                                                []
                                            )
                                        }

                                        fetchFilePointers()
                                    })
                                }
                            })

                        break

                    case "tag":
                        if (file.tag) {
                            fetch(`/files/manage`, {
                                method: "POST",
                                body: JSON.stringify({
                                    target: [file.id],
                                    action: "setTag",
                                }),
                            }).then(fetchFilePointers)
                            return
                        }

                        optPicker
                            .picker("Enter a tag (max 30char)", [
                                {
                                    name: "Tag name",
                                    icon: "/assets/icons/tag.svg",
                                    id: "tag",
                                    inputSettings: {},
                                },
                                {
                                    name: "OK",
                                    icon: "/assets/icons/update.svg",
                                    description: "",
                                    id: true,
                                },
                            ])
                            .then((exp) => {
                                if (exp && exp.selected) {
                                    fetch(`/files/manage`, {
                                        method: "POST",
                                        body: JSON.stringify({
                                            target: [file.id],
                                            action: "setTag",

                                            value: exp.tag || null,
                                        }),
                                    }).then((response) => {
                                        if (response.status != 200) {
                                            optPicker.picker(
                                                `${response.status} ${
                                                    response.headers.get(
                                                        "x-backup-status-message"
                                                    ) ||
                                                    response.statusText ||
                                                    ""
                                                }`,
                                                []
                                            )
                                        }

                                        fetchFilePointers()
                                    })
                                }
                            })

                        break
                }
            }
        })
}
